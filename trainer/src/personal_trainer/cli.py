from __future__ import annotations

import logging
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


def planner_options(function):
    function = click.option(
        "--ollama-model",
        "ollama_model",
        envvar="TRAINER_OLLAMA_MODEL",
        default="gpt-oss:20b",
        show_default=True,
        help="Local Ollama model tag used for plan generation.",
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
        "--timeout-seconds",
        type=int,
        envvar="TRAINER_OLLAMA_TIMEOUT_SECONDS",
        default=180,
        show_default=True,
        help="Timeout for a single Ollama planner request.",
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
    ollama_model: str,
    ollama_base_url: str,
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
    LOGGER.info(
        "Starting plan generation with model '%s' via %s",
        ollama_model,
        ollama_base_url,
    )
    try:
        plan = build_plan(
            profile,
            plan_version=state.plan_version + 1,
            client_config=OllamaClientConfig(
                model=ollama_model,
                base_url=ollama_base_url,
                timeout_seconds=max(30, timeout_seconds),
            ),
        )
    except WorkoutPlannerError as error:
        raise click.ClickException(str(error)) from error

    LOGGER.info("Writing generated plan files")
    paths.plan.write_text(render_plan(plan, profile), encoding="utf-8")
    paths.coach_notes.write_text(render_coach_notes(plan, profile), encoding="utf-8")
    checkin_template_path = (
        paths.checkins_dir / f"{plan.generated_on.isoformat()}-checkin.md"
    )
    if not checkin_template_path.exists():
        checkin_template_path.write_text(
            render_checkin_template(plan), encoding="utf-8"
        )

    state.plan_version = plan.plan_version
    state.generated_plans += 1
    save_state(paths.state, state)
    LOGGER.info("Plan generation finished successfully")

    click.echo(f"Plan written to {paths.plan}")
    click.echo(f"Coach notes written to {paths.coach_notes}")
    click.echo(f"Check-in template written to {checkin_template_path}")


@main.command("refresh", help="Update the plan using a check-in Markdown file.")
@WORKSPACE_ARGUMENT
@CHECKIN_ARGUMENT
@planner_options
def refresh_command(
    workspace: Path,
    checkin: str,
    ollama_model: str,
    ollama_base_url: str,
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
    LOGGER.info(
        "Starting refreshed plan generation with model '%s' via %s",
        ollama_model,
        ollama_base_url,
    )
    try:
        plan = build_plan(
            profile,
            plan_version=state.plan_version + 1,
            checkin=checkin,
            client_config=OllamaClientConfig(
                model=ollama_model,
                base_url=ollama_base_url,
                timeout_seconds=max(30, timeout_seconds),
            ),
        )
    except WorkoutPlannerError as error:
        raise click.ClickException(str(error)) from error

    LOGGER.info("Writing refreshed plan files")
    paths.plan.write_text(render_plan(plan, profile), encoding="utf-8")
    paths.coach_notes.write_text(
        render_coach_notes(plan, profile, checkin=checkin), encoding="utf-8"
    )

    next_checkin_path = (
        paths.checkins_dir / f"{plan.generated_on.isoformat()}-checkin.md"
    )
    if not next_checkin_path.exists():
        next_checkin_path.write_text(render_checkin_template(plan), encoding="utf-8")

    state.plan_version = plan.plan_version
    state.generated_plans += 1
    state.last_check_in = checkin.check_in_date.isoformat()
    save_state(paths.state, state)
    LOGGER.info("Plan refresh finished successfully")

    click.echo(f"Updated plan written to {paths.plan}")
    click.echo(f"Updated coach notes written to {paths.coach_notes}")
    click.echo(f"Next check-in template written to {next_checkin_path}")


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


@main.command("recipes", help="Suggest recipes from pantry ingredients and the workspace goal.")
@WORKSPACE_ARGUMENT
@click.option(
    "--ingredients",
    required=True,
    help="Comma-separated pantry ingredients, for example 'chicken, rice, broccoli'.",
)
@click.option("--goal", default=None, help="Override the workspace goal for this recipe search.")
@click.option("--limit", default=5, show_default=True, help="Maximum number of recipes to show.")
def recipes_command(workspace: Path, ingredients: str, goal: str | None, limit: int) -> None:
    paths = ensure_workspace(workspace)
    if not paths.profile.exists():
        raise click.ClickException(f"Missing profile: {paths.profile}")

    profile = load_profile(paths.profile)
    pantry_items = parse_pantry_items(ingredients)
    if not pantry_items:
        raise click.ClickException("No pantry ingredients were provided.")

    suggestions = suggest_recipes(profile, pantry_items, goal_override=goal, limit=max(1, limit))
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
