from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import cast

import click
from dotenv import load_dotenv

from personal_trainer.blob_sync import (
    BlobAccess,
    BlobPublishError,
    default_blob_access,
    default_blob_prefix,
    publish_workspace_to_blob,
)
from personal_trainer.llm import start_session
from personal_trainer.markdown_io import (
    ensure_workspace,
    load_checkin,
    load_profile,
    read_planned_workouts_from_plan_json,
    load_state,
    render_checkin_template,
    render_coach_notes,
    render_plan,
    render_plan_json,
    render_profile_json,
    render_profile_template,
    save_state,
)
from personal_trainer.notes_publisher import NotesPublishError, publish_plan_to_notes
from personal_trainer.ollama_client import OllamaClientConfig
from personal_trainer.openai_client import OpenAIClientConfig
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


@click.group(cls=TrainerGroup, help="Markdown-first personal trainer application.")
def main() -> None:
    """Top-level CLI group."""


@main.command("init", help="Create a Markdown workspace for a user.")
@WORKSPACE_ARGUMENT
def init_command(workspace: Path) -> None:
    paths = ensure_workspace(workspace)
    if not paths.profile.exists():
        paths.profile.write_text(render_profile_template(), encoding="utf-8")
    profile = load_profile(paths.profile)
    paths.profile_json.write_text(render_profile_json(profile), encoding="utf-8")
    save_state(paths.state, load_state(paths.state))
    click.echo(f"Workspace ready at {paths.root}")
    click.echo(
        f"Fill out {paths.profile.name}, then run: personal-trainer plan {paths.root.name}"
    )


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
    paths = ensure_workspace(workspace)
    LOGGER.info("Preparing workspace '%s' for plan generation", paths.root.name)
    if not paths.profile.exists():
        raise click.ClickException(f"Missing profile: {paths.profile}")

    LOGGER.info("Loading athlete profile from %s", paths.profile)
    profile = load_profile(paths.profile)
    paths.profile_json.write_text(render_profile_json(profile), encoding="utf-8")
    checkin_lookup = _find_latest_checkin(paths.root)
    checkin = checkin_lookup[0] if checkin_lookup is not None else None
    if checkin_lookup is None:
        LOGGER.info("No check-in files found for workspace '%s'", paths.root.name)
    else:
        _, checkin_path = checkin_lookup
        LOGGER.info(
            "Using latest check-in file '%s' for plan generation", checkin_path.name
        )
    state = load_state(paths.state)
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
        workspace=paths.root,
        profile=profile,
        plan_version=state.plan_version + 1,
        checkin=checkin,
        targets=targets,
        session_id=resolved_session_id,
        ollama_base_url=ollama_base_url,
        openai_base_url=openai_base_url,
        openai_api_key=openai_api_key,
        timeout_seconds=timeout_seconds,
        max_review_iterations=max_review_iterations,
    )

    state.plan_version = generated_plans[0].result.plan.plan_version
    state.generated_plans += len(generated_plans)
    state.last_check_in = checkin.check_in_date.isoformat() if checkin is not None else None
    save_state(paths.state, state)
    LOGGER.info("Plan generation finished successfully")

    click.echo(f"Profile data written to {paths.profile_json}")
    for output in outputs:
        click.echo(f"Plan written to {output.plan_markdown}")
        click.echo(f"Plan data written to {output.plan_json}")
        click.echo(f"Plan review written to {output.plan_review_json}")
        click.echo(f"Coach notes written to {output.coach_notes_markdown}")
    for generated in generated_plans:
        if generated.result.reached_max_iterations:
            unresolved = generated.result.review_report.get("unresolved_personas", [])
            click.echo(
                "Warning: review loop hit max iterations for "
                f"{generated.target.provider}/{generated.target.model}. "
                f"Unresolved reviewers: {', '.join(unresolved) if unresolved else 'unknown'}."
            )


@main.command("checkin", help="Create a new weekly check-in Markdown file.")
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
    paths = ensure_workspace(workspace)
    resolved_date = checkin_date.date() if checkin_date is not None else date.today()
    workouts_planned = read_planned_workouts_from_plan_json(paths.plan_json)
    checkin_path = paths.checkins_dir / f"{resolved_date.isoformat()}-checkin.md"

    LOGGER.info("Creating check-in template for workspace '%s'", paths.root.name)
    if checkin_date is None:
        LOGGER.info("No --date provided; using today's date %s", resolved_date.isoformat())
    else:
        LOGGER.info("Using provided check-in date %s", resolved_date.isoformat())
    LOGGER.info("Planned workouts default resolved to %s", workouts_planned)

    if checkin_path.exists():
        LOGGER.error("Check-in template already exists at %s", checkin_path)
        raise click.ClickException(
            f"Check-in already exists: {checkin_path}. "
            "Edit the existing file or choose another date with --date."
        )

    checkin_path.write_text(
        render_checkin_template(
            checkin_date=resolved_date,
            workouts_planned=workouts_planned,
        ),
        encoding="utf-8",
    )
    LOGGER.info("Created check-in template at %s", checkin_path)
    click.echo(f"Check-in template written to {checkin_path}")


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
    workspace: Path,
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
    outputs: list[PlannerOutputPaths] = []
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
                    llm_log_path=workspace / ".trainer" / "logs" / "llm_calls.jsonl",
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
                    llm_log_path=workspace / ".trainer" / "logs" / "llm_calls.jsonl",
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
        output_paths = _planner_output_paths(
            workspace, target, comparison_mode=comparison_mode
        )
        LOGGER.info(
            "Writing %s artifacts for model '%s' to %s, %s, and %s",
            target.provider,
            target.model,
            output_paths.plan_markdown,
            output_paths.plan_json,
            output_paths.coach_notes_markdown,
        )
        legacy_pdf = output_paths.plan_markdown.with_suffix(".pdf")
        if legacy_pdf.exists():
            LOGGER.info("Removing stale PDF artifact at %s", legacy_pdf)
            legacy_pdf.unlink()
        plan_markdown = render_plan(build_result.plan, profile)
        output_paths.plan_markdown.write_text(plan_markdown, encoding="utf-8")
        output_paths.plan_json.write_text(
            render_plan_json(build_result.plan, profile), encoding="utf-8"
        )
        output_paths.plan_review_json.write_text(
            json.dumps(build_result.review_report, indent=2), encoding="utf-8"
        )
        output_paths.coach_notes_markdown.write_text(
            render_coach_notes(build_result.plan, profile, checkin=checkin),
            encoding="utf-8",
        )
        outputs.append(output_paths)
    return plans, outputs


@main.command("status", help="Show the current workspace state.")
@WORKSPACE_ARGUMENT
def status_command(workspace: Path) -> None:
    paths = ensure_workspace(workspace)
    state = load_state(paths.state)
    click.echo(f"Workspace: {paths.root}")
    click.echo(f"Profile exists: {'yes' if paths.profile.exists() else 'no'}")
    click.echo(f"Plan exists: {'yes' if paths.plan.exists() else 'no'}")
    click.echo(f"Plan version: {state.plan_version}")
    click.echo(f"Generated plans: {state.generated_plans}")
    click.echo(f"Last check-in: {state.last_check_in or 'none'}")


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


@main.command(
    "publish-web",
    help="Upload the workspace artifacts to Vercel Blob.",
)
@WORKSPACE_ARGUMENT
@click.option(
    "--prefix",
    default=default_blob_prefix,
    show_default="env TRAINER_BLOB_PREFIX or personal-trainer",
    help="Blob pathname prefix used by the frontend.",
)
@click.option(
    "--access",
    type=click.Choice(["public", "private"]),
    default=default_blob_access,
    show_default="env TRAINER_BLOB_ACCESS or private",
    help="Blob access level for the uploaded files.",
)
def publish_web_command(workspace: Path, prefix: str, access: str) -> None:
    try:
        result = publish_workspace_to_blob(
            workspace,
            prefix=prefix,
            access=cast(BlobAccess, access),
        )
    except BlobPublishError as error:
        raise click.ClickException(str(error)) from error

    click.echo(
        f"Published workspace '{result.workspace}' to Blob prefix '{result.prefix}'"
    )
    click.echo(f"Workspace files uploaded: {result.workspace_files_uploaded}")
    click.echo(f"Remote files deleted: {result.remote_files_deleted}")
    click.echo(
        "Set TRAINER_DATA_SOURCE=blob in the frontend environment before deploying."
    )


if __name__ == "__main__":
    main()
