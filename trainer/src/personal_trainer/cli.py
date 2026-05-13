from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path

import click
from dotenv import load_dotenv

from personal_trainer.db import (
    TRAINER_SYNC_TABLES,
    create_workspace,
    get_database_url,
    get_prod_database_url,
    latest_checkin,
    list_checkins,
    list_workspaces,
    next_plan_version,
    read_profile,
    run_migrations,
    slugify_workspace_name,
    sync_tables,
    upsert_checkin,
)
from personal_trainer.importers import (
    import_filesystem_workspaces,
    import_recipe_snapshots_from_json,
)
from personal_trainer.llm import start_session
from personal_trainer.markdown_io import (
    ensure_workspace,
    load_checkin,
    load_profile,
)
from personal_trainer.notes_publisher import NotesPublishError, publish_plan_to_notes
from personal_trainer.ollama_client import OllamaClientConfig
from personal_trainer.openai_client import OpenAIClientConfig
from personal_trainer.db import save_workout_plan, upsert_profile
from personal_trainer.workout_planner import (
    WorkoutPlannerError,
    WorkoutPlanBuildResult,
    build_plan_with_review,
)

WORKSPACES_ROOT = Path(__file__).resolve().parents[3] / "workspaces"
LOGGER = logging.getLogger(__name__)
CHECKIN_FILENAME_PATTERN = re.compile(r"^(?P<date>\d{4}-\d{2}-\d{2})-checkin\.md$")


def _workspace_argument(_: click.Context, __: click.Parameter, value: str) -> Path:
    workspace_name = Path(value).name
    return (WORKSPACES_ROOT / workspace_name).resolve()


WORKSPACE_ARGUMENT = click.argument("workspace", callback=_workspace_argument)


@dataclass(frozen=True, slots=True)
class PlannerTarget:
    provider: str
    model: str


@dataclass(frozen=True, slots=True)
class PlannerOutputPaths:
    plan_markdown: Path
    plan_json: Path
    plan_review_json: Path
    coach_notes_markdown: Path


@dataclass(frozen=True, slots=True)
class GeneratedPlanResult:
    target: PlannerTarget
    result: WorkoutPlanBuildResult


def _split_models(value: str | None) -> tuple[str, ...]:
    if value is None:
        return ()
    parts = [item.strip() for item in value.split(",")]
    return tuple(item for item in parts if item)


def _parse_model_option(
    _: click.Context, __: click.Parameter, value: tuple[str, ...]
) -> tuple[str, ...]:
    models: list[str] = []
    for item in value:
        models.extend(_split_models(item))
    return tuple(models)


def _sanitize_target_slug(target: PlannerTarget) -> str:
    slug = f"{target.provider}-{target.model.lower()}"
    slug = re.sub(r"[^a-z0-9]+", "-", slug).strip("-")
    return slug or target.provider


def _planner_output_paths(
    workspace: Path, target: PlannerTarget, *, comparison_mode: bool
) -> PlannerOutputPaths:
    if not comparison_mode:
        return PlannerOutputPaths(
            plan_markdown=workspace / "plan.md",
            plan_json=workspace / "plan.json",
            plan_review_json=workspace / "plan_review.json",
            coach_notes_markdown=workspace / "coach_notes.md",
        )

    slug = _sanitize_target_slug(target)
    return PlannerOutputPaths(
        plan_markdown=workspace / f"plan-{slug}.md",
        plan_json=workspace / f"plan-{slug}.json",
        plan_review_json=workspace / f"plan_review-{slug}.json",
        coach_notes_markdown=workspace / f"coach-notes-{slug}.md",
    )


def planner_options(function):
    function = click.option(
        "--ollama-model",
        "ollama_model",
        multiple=True,
        envvar="TRAINER_OLLAMA_MODELS",
        callback=_parse_model_option,
        help="Repeatable Ollama model tag used for plan generation. Accepts comma-separated values.",
    )(function)
    function = click.option(
        "--openai-model",
        "openai_model",
        multiple=True,
        envvar="TRAINER_OPENAI_MODELS",
        callback=_parse_model_option,
        help="Repeatable OpenAI model name used for plan generation. Accepts comma-separated values.",
    )(function)
    function = click.option(
        "--ollama-base-url",
        "ollama_base_url",
        envvar="TRAINER_OLLAMA_BASE_URL",
        default="http://localhost:11434",
        show_default=True,
        help="Base URL for the local Ollama server.",
    )(function)
    function = click.option(
        "--openai-base-url",
        "openai_base_url",
        envvar="OPENAI_BASE_URL",
        default="https://api.openai.com/v1",
        show_default=True,
        help="Base URL for the OpenAI-compatible API.",
    )(function)
    function = click.option(
        "--openai-api-key",
        "openai_api_key",
        envvar="OPENAI_API_KEY",
        default="",
        help="API key used for OpenAI plan generation.",
    )(function)
    function = click.option(
        "--session-id",
        "session_id",
        default="",
        help="Optional Langfuse session id shared across model calls in this command.",
    )(function)
    function = click.option(
        "--timeout-seconds",
        type=int,
        envvar="TRAINER_OLLAMA_TIMEOUT_SECONDS",
        default=180,
        show_default=True,
        help="Timeout for a single planner request.",
    )(function)
    function = click.option(
        "--max-review-iterations",
        type=int,
        envvar="TRAINER_PLAN_REVIEW_MAX_ITERATIONS",
        default=5,
        show_default=True,
        help="Maximum planner-reviewer iterations before accepting the latest draft with a warning.",
    )(function)
    return function


def _configure_progress_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | %(message)s",
        force=True,
    )


def _resolve_session_id(
    *,
    session_id: str,
    workflow_name: str,
) -> str:
    resolved_session_id = session_id.strip()
    if resolved_session_id:
        return resolved_session_id
    return start_session(workflow_name)


def _find_latest_checkin(workspace: Path):
    dated_checkins: list[tuple[date, Path]] = []
    checkins_dir = workspace / "checkins"
    if not checkins_dir.exists():
        return None

    for candidate in checkins_dir.iterdir():
        if not candidate.is_file():
            continue
        match = CHECKIN_FILENAME_PATTERN.fullmatch(candidate.name)
        if match is None:
            continue
        dated_checkins.append((date.fromisoformat(match.group("date")), candidate))

    if not dated_checkins:
        return None

    _, latest_path = max(dated_checkins, key=lambda item: item[0])
    try:
        return load_checkin(latest_path), latest_path
    except ValueError as error:
        raise click.ClickException(
            f"Latest check-in '{latest_path}' is invalid: {error}"
        ) from error


def _resolve_local_env_file() -> Path | None:
    env_filename = ".env.local"
    cwd = Path.cwd().resolve()
    trainer_root = Path(__file__).resolve().parents[2]

    candidates = [cwd / env_filename, cwd / "trainer" / env_filename]
    candidates.extend(parent / env_filename for parent in cwd.parents)
    candidates.append(trainer_root / env_filename)

    seen: set[Path] = set()
    for candidate in candidates:
        resolved = candidate.resolve()
        if resolved in seen:
            continue
        seen.add(resolved)
        if resolved.is_file():
            return resolved
    return None


def _load_local_env_file() -> None:
    env_file = _resolve_local_env_file()
    if env_file is None:
        return
    load_dotenv(dotenv_path=env_file, override=False)


class TrainerGroup(click.Group):
    def make_context(self, info_name, args, parent=None, **extra):
        _load_local_env_file()
        return super().make_context(info_name, args, parent=parent, **extra)


@click.group(cls=TrainerGroup, help="Postgres-backed personal trainer application.")
def main() -> None:
    """Top-level CLI group."""


@main.command("init", help="Create a workspace and default athlete profile in Postgres.")
@WORKSPACE_ARGUMENT
def init_command(workspace: Path) -> None:
    workspace_slug = slugify_workspace_name(workspace.name)
    create_workspace(workspace_slug)
    click.echo(f"Workspace '{workspace_slug}' is ready in Postgres.")
    click.echo("Fill out the athlete profile in the web app, then run personal-trainer plan.")


@main.command(
    "plan",
    help="Generate a plan from profile.md, optionally using the latest check-in file.",
)
@WORKSPACE_ARGUMENT
@planner_options
def plan_command(
    workspace: Path,
    ollama_model: tuple[str, ...],
    openai_model: tuple[str, ...],
    ollama_base_url: str,
    openai_base_url: str,
    openai_api_key: str,
    session_id: str,
    timeout_seconds: int,
    max_review_iterations: int,
) -> None:
    _configure_progress_logging()
    workspace_slug = slugify_workspace_name(workspace.name)
    LOGGER.info("Preparing workspace '%s' for plan generation", workspace_slug)
    profile = read_profile(workspace_slug)
    checkin = latest_checkin(workspace_slug)
    if checkin is None:
        LOGGER.info("No check-ins found for workspace '%s'", workspace_slug)
    else:
        LOGGER.info(
            "Using latest check-in dated %s for plan generation",
            checkin.check_in_date.isoformat(),
        )
    targets = _resolve_planner_targets(
        ollama_models=ollama_model,
        openai_models=openai_model,
        openai_api_key=openai_api_key,
    )
    resolved_session_id = _resolve_session_id(
        session_id=session_id,
        workflow_name="weekly_plan_generation",
    )
    LOGGER.info(
        "Using Langfuse session id '%s' for this plan command",
        resolved_session_id,
    )
    generated_plans, outputs = _build_plans(
        workspace_slug=workspace_slug,
        profile=profile,
        plan_version=next_plan_version(workspace_slug),
        checkin=checkin,
        targets=targets,
        session_id=resolved_session_id,
        ollama_base_url=ollama_base_url,
        openai_base_url=openai_base_url,
        openai_api_key=openai_api_key,
        timeout_seconds=timeout_seconds,
        max_review_iterations=max_review_iterations,
    )
    LOGGER.info("Plan generation finished successfully")

    for output in outputs:
        click.echo(
            f"Stored workout plan version {output.result.plan.plan_version} for workspace '{workspace_slug}'"
        )
    for generated in generated_plans:
        if generated.result.reached_max_iterations:
            unresolved = generated.result.review_report.get("unresolved_personas", [])
            click.echo(
                "Warning: review loop hit max iterations for "
                f"{generated.target.provider}/{generated.target.model}. "
                f"Unresolved reviewers: {', '.join(unresolved) if unresolved else 'unknown'}."
            )


@main.command("checkin", help="Create or update a check-in row in Postgres.")
@WORKSPACE_ARGUMENT
@click.option(
    "--date",
    "checkin_date",
    type=click.DateTime(formats=["%Y-%m-%d"]),
    default=None,
    help="Check-in date in YYYY-MM-DD format. Defaults to today.",
)
def checkin_command(workspace: Path, checkin_date: datetime | None) -> None:
    _configure_progress_logging()
    workspace_slug = slugify_workspace_name(workspace.name)
    profile = read_profile(workspace_slug)
    resolved_date = checkin_date.date() if checkin_date is not None else date.today()
    workouts_planned = max(0, profile.training_days)

    LOGGER.info("Creating check-in row for workspace '%s'", workspace_slug)
    if checkin_date is None:
        LOGGER.info("No --date provided; using today's date %s", resolved_date.isoformat())
    else:
        LOGGER.info("Using provided check-in date %s", resolved_date.isoformat())
    LOGGER.info("Planned workouts default resolved to %s", workouts_planned)

    upsert_checkin(
        workspace_slug,
        load_checkin(
            _write_temporary_checkin_template(
                workspace_slug,
                resolved_date,
                workouts_planned,
            )
        ),
    )
    LOGGER.info("Created check-in row for workspace '%s'", workspace_slug)
    click.echo(f"Check-in row stored for {workspace_slug} on {resolved_date.isoformat()}")


def _resolve_planner_targets(
    *,
    ollama_models: tuple[str, ...],
    openai_models: tuple[str, ...],
    openai_api_key: str,
) -> list[PlannerTarget]:
    targets = [PlannerTarget(provider="ollama", model=model) for model in ollama_models]
    targets.extend(
        PlannerTarget(provider="openai", model=model) for model in openai_models
    )
    if not targets:
        targets.append(PlannerTarget(provider="ollama", model="gpt-oss:20b"))
    if openai_models and not openai_api_key.strip():
        raise click.ClickException(
            "OpenAI model generation requires OPENAI_API_KEY or --openai-api-key."
        )
    return targets


def _build_plans(
    *,
    workspace_slug: str,
    profile,
    plan_version: int,
    targets: list[PlannerTarget],
    session_id: str,
    ollama_base_url: str,
    openai_base_url: str,
    openai_api_key: str,
    timeout_seconds: int,
    max_review_iterations: int,
    checkin=None,
):
    plans: list[GeneratedPlanResult] = []
    outputs: list[GeneratedPlanResult] = []
    comparison_mode = len(targets) > 1
    for target in targets:
        LOGGER.info(
            "Starting %s plan generation with model '%s'",
            target.provider,
            target.model,
        )
        try:
            if target.provider == "openai":
                build_result = build_plan_with_review(
                    profile,
                    plan_version=plan_version,
                    checkin=checkin,
                    workflow_name="weekly_plan_generation",
                    session_id=session_id,
                    llm_log_path=WORKSPACES_ROOT / workspace_slug / ".trainer" / "logs" / "llm_calls.jsonl",
                    openai_client_config=OpenAIClientConfig(
                        api_key=openai_api_key,
                        model=target.model,
                        base_url=openai_base_url,
                        timeout_seconds=max(30, timeout_seconds),
                    ),
                    max_review_iterations=max_review_iterations,
                )
            else:
                build_result = build_plan_with_review(
                    profile,
                    plan_version=plan_version,
                    checkin=checkin,
                    workflow_name="weekly_plan_generation",
                    session_id=session_id,
                    llm_log_path=WORKSPACES_ROOT / workspace_slug / ".trainer" / "logs" / "llm_calls.jsonl",
                    client_config=OllamaClientConfig(
                        model=target.model,
                        base_url=ollama_base_url,
                        timeout_seconds=max(30, timeout_seconds),
                    ),
                    max_review_iterations=max_review_iterations,
                )
        except WorkoutPlannerError as error:
            raise click.ClickException(str(error)) from error
        plans.append(GeneratedPlanResult(target=target, result=build_result))
        save_workout_plan(workspace_slug, build_result.plan, profile)
        outputs.append(plans[-1])
    return plans, outputs


@main.command("status", help="Show the current workspace state.")
@WORKSPACE_ARGUMENT
def status_command(workspace: Path) -> None:
    workspace_slug = slugify_workspace_name(workspace.name)
    profile = read_profile(workspace_slug)
    checkins = list_checkins(workspace_slug)
    click.echo(f"Workspace: {workspace_slug}")
    click.echo(f"Athlete profile: {profile.name}")
    click.echo(f"Training days: {profile.training_days}")
    click.echo(f"Check-ins: {len(checkins)}")
    click.echo(f"Next plan version: {next_plan_version(workspace_slug)}")


@main.command("publish-notes", help="Publish the current plan to Apple Notes on macOS.")
@WORKSPACE_ARGUMENT
@click.option(
    "--account", default="iCloud", show_default=True, help="Notes account name."
)
@click.option(
    "--folder",
    "folder_name",
    default="Personal Trainer",
    show_default=True,
    help="Destination Notes folder.",
)
@click.option("--title", default=None, help="Override the note title.")
def publish_notes_command(
    workspace: Path, account: str, folder_name: str, title: str | None
) -> None:
    paths = ensure_workspace(workspace)
    try:
        result = publish_plan_to_notes(
            paths.root,
            account=account,
            folder=folder_name,
            title=title,
        )
    except NotesPublishError as error:
        raise click.ClickException(str(error)) from error

    click.echo(
        f"Published '{result.title}' to Apple Notes in {result.account}/{result.folder}"
    )
    click.echo(f"Note ID: {result.note_id}")


@main.group("db", help="Manage the local PostgreSQL development database.")
def db_group() -> None:
    """Database management commands."""


@db_group.command("up", help="Start the local PostgreSQL Docker Compose service.")
def db_up_command() -> None:
    _run_local_shell_command("docker compose up -d")
    click.echo("Local Postgres service started.")


@db_group.command("down", help="Stop the local PostgreSQL Docker Compose service.")
def db_down_command() -> None:
    _run_local_shell_command("docker compose down")
    click.echo("Local Postgres service stopped.")


@db_group.command("destroy", help="Destroy the local PostgreSQL service and volume.")
def db_destroy_command() -> None:
    _run_local_shell_command("docker compose down -v")
    click.echo("Local Postgres service and data volume destroyed.")


@db_group.command("setup", help="Apply SQL migrations to the configured database.")
def db_setup_command() -> None:
    applied = run_migrations(get_database_url())
    click.echo(f"Applied {applied} SQL migration file(s).")


@main.command("import-filesystem", help="Import filesystem workspaces from ./workspaces into Postgres.")
def import_filesystem_command() -> None:
    imported = import_filesystem_workspaces(WORKSPACES_ROOT, database_url=get_database_url())
    click.echo(f"Imported {imported} workspace(s) from the filesystem.")


@main.command("import-blob-recipes", help="Import saved recipe snapshots from a JSON export into Postgres.")
@click.option(
    "--snapshot-export",
    "snapshot_export",
    type=click.Path(path_type=Path, exists=True, dir_okay=False),
    required=True,
    help="Path to a JSON file containing saved recipe snapshots.",
)
def import_blob_recipes_command(snapshot_export: Path) -> None:
    imported = import_recipe_snapshots_from_json(snapshot_export, database_url=get_database_url())
    click.echo(f"Imported {imported} saved recipe snapshot(s).")


@main.group("sync", help="Synchronize trainer-domain tables between local Postgres and Neon.")
def sync_group() -> None:
    """Synchronization commands."""


@sync_group.command("pull-prod", help="Pull trainer-domain tables from Neon into local Postgres.")
def sync_pull_prod_command() -> None:
    sync_tables(get_prod_database_url(), get_database_url(), TRAINER_SYNC_TABLES)
    click.echo("Pulled trainer-domain tables from production into local Postgres.")


@sync_group.command("push-prod", help="Push local trainer-domain tables into Neon.")
def sync_push_prod_command() -> None:
    sync_tables(get_database_url(), get_prod_database_url(), TRAINER_SYNC_TABLES)
    click.echo("Pushed local trainer-domain tables into production Postgres.")


def _run_local_shell_command(command: str) -> None:
    import subprocess

    result = subprocess.run(command, shell=True, check=False)
    if result.returncode != 0:
        raise click.ClickException(f"Command failed: {command}")


def _write_temporary_checkin_template(workspace_slug: str, checkin_date: date, workouts_planned: int) -> Path:
    from tempfile import NamedTemporaryFile

    content = f"""# Weekly Check-In

## Summary
- Date: {checkin_date.isoformat()}
- Workouts completed: {workouts_planned}
- Workouts planned: {workouts_planned}
- Average difficulty (1-10): 6
- Energy (1-10): 7
- Soreness (1-10): 4
- Body weight kg:

## Wins
-

## Struggles
-

## Notes
- Created from the CLI for workspace {workspace_slug}
"""
    handle = NamedTemporaryFile("w", encoding="utf-8", delete=False, suffix=".md")
    handle.write(content)
    handle.close()
    return Path(handle.name)


if __name__ == "__main__":
    main()
