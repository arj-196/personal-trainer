from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from pathlib import Path
from typing import cast

import click

from personal_trainer.blob_sync import (
    BlobAccess,
    BlobPublishError,
    default_blob_access,
    default_blob_prefix,
    publish_workspace_to_blob,
)
from personal_trainer.exercise_library import sync_workspace_library
from personal_trainer.markdown_io import (
    ensure_workspace,
    load_checkin,
    load_profile,
    load_state,
    render_checkin_template,
    render_coach_notes,
    render_plan,
    render_profile_template,
    save_state,
)
from personal_trainer.notes_publisher import NotesPublishError, publish_plan_to_notes
from personal_trainer.ollama_client import OllamaClientConfig
from personal_trainer.openai_client import OpenAIClientConfig
from personal_trainer.recipe_suggester import parse_pantry_items, suggest_recipes
from personal_trainer.workout_planner import WorkoutPlannerError, build_plan

WORKSPACES_ROOT = Path(__file__).resolve().parents[3] / "workspaces"
LOGGER = logging.getLogger(__name__)


def _workspace_argument(_: click.Context, __: click.Parameter, value: str) -> Path:
    workspace_name = Path(value).name
    return (WORKSPACES_ROOT / workspace_name).resolve()


def _resolve_checkin_path(workspace: Path, checkin: str) -> Path:
    raw_path = Path(checkin).expanduser()
    if raw_path.is_absolute():
        return raw_path.resolve()

    candidates = [
        workspace / "checkins" / raw_path.name,
        workspace / raw_path,
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate.resolve()
    return candidates[0].resolve()


WORKSPACE_ARGUMENT = click.argument("workspace", callback=_workspace_argument)
CHECKIN_ARGUMENT = click.argument("checkin")


@dataclass(frozen=True, slots=True)
class PlannerTarget:
    provider: str
    model: str


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


def _comparison_paths(workspace: Path, target: PlannerTarget) -> tuple[Path, Path]:
    slug = _sanitize_target_slug(target)
    return (
        workspace / f"plan-{slug}.md",
        workspace / f"coach-notes-{slug}.md",
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
        "--timeout-seconds",
        type=int,
        envvar="TRAINER_OLLAMA_TIMEOUT_SECONDS",
        default=180,
        show_default=True,
        help="Timeout for a single planner request.",
    )(function)
    return function


def _configure_progress_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | %(message)s",
        force=True,
    )


@click.group(help="Markdown-first personal trainer application.")
def main() -> None:
    """Top-level CLI group."""


@main.command("init", help="Create a Markdown workspace for a user.")
@WORKSPACE_ARGUMENT
def init_command(workspace: Path) -> None:
    paths = ensure_workspace(workspace)
    sync_workspace_library(paths.root)
    if not paths.profile.exists():
        paths.profile.write_text(render_profile_template(), encoding="utf-8")
    save_state(paths.state, load_state(paths.state))
    click.echo(f"Workspace ready at {paths.root}")
    click.echo(
        f"Fill out {paths.profile.name}, then run: personal-trainer plan {paths.root.name}"
    )


@main.command("plan", help="Generate the first plan from profile.md.")
@WORKSPACE_ARGUMENT
@planner_options
def plan_command(
    workspace: Path,
    ollama_model: tuple[str, ...],
    openai_model: tuple[str, ...],
    ollama_base_url: str,
    openai_base_url: str,
    openai_api_key: str,
    timeout_seconds: int,
) -> None:
    _configure_progress_logging()
    paths = ensure_workspace(workspace)
    LOGGER.info("Preparing workspace '%s' for plan generation", paths.root.name)
    sync_workspace_library(paths.root)
    if not paths.profile.exists():
        raise click.ClickException(f"Missing profile: {paths.profile}")

    LOGGER.info("Loading athlete profile from %s", paths.profile)
    profile = load_profile(paths.profile)
    state = load_state(paths.state)
    targets = _resolve_planner_targets(
        ollama_models=ollama_model,
        openai_models=openai_model,
        openai_api_key=openai_api_key,
    )
    plans, outputs = _build_plans(
        workspace=paths.root,
        profile=profile,
        plan_version=state.plan_version + 1,
        targets=targets,
        ollama_base_url=ollama_base_url,
        openai_base_url=openai_base_url,
        openai_api_key=openai_api_key,
        timeout_seconds=timeout_seconds,
    )
    checkin_template_path = (
        paths.checkins_dir / f"{plans[0][1].generated_on.isoformat()}-checkin.md"
    )
    if not checkin_template_path.exists():
        checkin_template_path.write_text(
            render_checkin_template(plans[0][1]), encoding="utf-8"
        )

    state.plan_version = plans[0][1].plan_version
    state.generated_plans += len(plans)
    save_state(paths.state, state)
    LOGGER.info("Plan generation finished successfully")

    for plan_path, coach_notes_path in outputs:
        click.echo(f"Plan written to {plan_path}")
        click.echo(f"Coach notes written to {coach_notes_path}")
    click.echo(f"Check-in template written to {checkin_template_path}")


@main.command("refresh", help="Update the plan using a check-in Markdown file.")
@WORKSPACE_ARGUMENT
@CHECKIN_ARGUMENT
@planner_options
def refresh_command(
    workspace: Path,
    checkin: str,
    ollama_model: tuple[str, ...],
    openai_model: tuple[str, ...],
    ollama_base_url: str,
    openai_base_url: str,
    openai_api_key: str,
    timeout_seconds: int,
) -> None:
    _configure_progress_logging()
    paths = ensure_workspace(workspace)
    LOGGER.info("Preparing workspace '%s' for plan refresh", paths.root.name)
    sync_workspace_library(paths.root)
    checkin_path = _resolve_checkin_path(paths.root, checkin)
    if not paths.profile.exists():
        raise click.ClickException(f"Missing profile: {paths.profile}")
    if not checkin_path.exists():
        raise click.ClickException(f"Missing check-in: {checkin_path}")

    LOGGER.info("Loading athlete profile and check-in data")
    profile = load_profile(paths.profile)
    checkin = load_checkin(checkin_path)
    state = load_state(paths.state)
    targets = _resolve_planner_targets(
        ollama_models=ollama_model,
        openai_models=openai_model,
        openai_api_key=openai_api_key,
    )
    plans, outputs = _build_plans(
        workspace=paths.root,
        profile=profile,
        plan_version=state.plan_version + 1,
        checkin=checkin,
        targets=targets,
        ollama_base_url=ollama_base_url,
        openai_base_url=openai_base_url,
        openai_api_key=openai_api_key,
        timeout_seconds=timeout_seconds,
    )

    next_checkin_path = (
        paths.checkins_dir / f"{plans[0][1].generated_on.isoformat()}-checkin.md"
    )
    if not next_checkin_path.exists():
        next_checkin_path.write_text(
            render_checkin_template(plans[0][1]), encoding="utf-8"
        )

    state.plan_version = plans[0][1].plan_version
    state.generated_plans += len(plans)
    state.last_check_in = checkin.check_in_date.isoformat()
    save_state(paths.state, state)
    LOGGER.info("Plan refresh finished successfully")

    for plan_path, coach_notes_path in outputs:
        click.echo(f"Updated plan written to {plan_path}")
        click.echo(f"Updated coach notes written to {coach_notes_path}")
    click.echo(f"Next check-in template written to {next_checkin_path}")


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
    ollama_base_url: str,
    openai_base_url: str,
    openai_api_key: str,
    timeout_seconds: int,
    checkin=None,
):
    plans = []
    outputs: list[tuple[Path, Path]] = []
    comparison_mode = len(targets) > 1
    for target in targets:
        LOGGER.info(
            "Starting %s plan generation with model '%s'",
            target.provider,
            target.model,
        )
        try:
            if target.provider == "openai":
                plan = build_plan(
                    profile,
                    plan_version=plan_version,
                    checkin=checkin,
                    openai_client_config=OpenAIClientConfig(
                        api_key=openai_api_key,
                        model=target.model,
                        base_url=openai_base_url,
                        timeout_seconds=max(30, timeout_seconds),
                    ),
                )
            else:
                plan = build_plan(
                    profile,
                    plan_version=plan_version,
                    checkin=checkin,
                    client_config=OllamaClientConfig(
                        model=target.model,
                        base_url=ollama_base_url,
                        timeout_seconds=max(30, timeout_seconds),
                    ),
                )
        except WorkoutPlannerError as error:
            raise click.ClickException(str(error)) from error
        plans.append((target, plan))
        if comparison_mode:
            plan_path, coach_notes_path = _comparison_paths(workspace, target)
        else:
            plan_path = workspace / "plan.md"
            coach_notes_path = workspace / "coach_notes.md"
        LOGGER.info(
            "Writing %s artifacts for model '%s' to %s and %s",
            target.provider,
            target.model,
            plan_path,
            coach_notes_path,
        )
        plan_path.write_text(render_plan(plan, profile), encoding="utf-8")
        coach_notes_path.write_text(
            render_coach_notes(plan, profile, checkin=checkin), encoding="utf-8"
        )
        outputs.append((plan_path, coach_notes_path))
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
    sync_workspace_library(paths.root)
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
    help="Upload the workspace and shared exercise library to Vercel Blob.",
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
@click.option(
    "--skip-library",
    is_flag=True,
    help="Upload only the selected workspace without refreshing shared library assets.",
)
def publish_web_command(
    workspace: Path, prefix: str, access: str, skip_library: bool
) -> None:
    try:
        result = publish_workspace_to_blob(
            workspace,
            prefix=prefix,
            access=cast(BlobAccess, access),
            include_library=not skip_library,
        )
    except BlobPublishError as error:
        raise click.ClickException(str(error)) from error

    click.echo(
        f"Published workspace '{result.workspace}' to Blob prefix '{result.prefix}'"
    )
    click.echo(f"Workspace files uploaded: {result.workspace_files_uploaded}")
    click.echo(f"Library files uploaded: {result.library_files_uploaded}")
    click.echo(f"Remote files deleted: {result.remote_files_deleted}")
    click.echo(
        "Set TRAINER_DATA_SOURCE=blob in the frontend environment before deploying."
    )


@main.command(
    "recipes", help="Suggest recipes from pantry ingredients and the workspace goal."
)
@WORKSPACE_ARGUMENT
@click.option(
    "--ingredients",
    required=True,
    help="Comma-separated pantry ingredients, for example 'chicken, rice, broccoli'.",
)
@click.option(
    "--goal", default=None, help="Override the workspace goal for this recipe search."
)
@click.option(
    "--limit", default=5, show_default=True, help="Maximum number of recipes to show."
)
def recipes_command(
    workspace: Path, ingredients: str, goal: str | None, limit: int
) -> None:
    paths = ensure_workspace(workspace)
    if not paths.profile.exists():
        raise click.ClickException(f"Missing profile: {paths.profile}")

    profile = load_profile(paths.profile)
    pantry_items = parse_pantry_items(ingredients)
    if not pantry_items:
        raise click.ClickException("No pantry ingredients were provided.")

    suggestions = suggest_recipes(
        profile, pantry_items, goal_override=goal, limit=max(1, limit)
    )
    if not suggestions:
        click.echo("No recipe suggestions matched the current pantry input.")
        return

    active_goal = goal or profile.goal
    click.echo(f"Recipe suggestions for {paths.root.name}")
    click.echo(f"Goal: {active_goal}")
    click.echo(f"Pantry: {', '.join(pantry_items)}")

    for index, suggestion in enumerate(suggestions, start=1):
        click.echo("")
        click.echo(f"{index}. {suggestion.title} [{suggestion.fit_label}]")
        click.echo(f"   Why: {suggestion.goal_fit_reason}")
        click.echo(f"   Uses: {', '.join(suggestion.pantry_ingredients_used)}")
        click.echo(
            f"   Missing: {', '.join(suggestion.missing_ingredients) if suggestion.missing_ingredients else 'none'}"
        )
        click.echo(
            f"   Time: {suggestion.estimated_prep_minutes} min prep + {suggestion.estimated_cook_minutes} min cook"
        )


if __name__ == "__main__":
    main()
