from __future__ import annotations

from pathlib import Path

import click

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
from personal_trainer.planner import build_plan


def _workspace_argument(_: click.Context, __: click.Parameter, value: str) -> Path:
    return Path(value).expanduser().resolve()


WORKSPACE_ARGUMENT = click.argument("workspace", callback=_workspace_argument)
CHECKIN_ARGUMENT = click.argument("checkin", callback=_workspace_argument)


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
        f"Fill out {paths.profile.name}, then run: personal-trainer plan {paths.root}"
    )


@main.command("plan", help="Generate the first plan from profile.md.")
@WORKSPACE_ARGUMENT
def plan_command(workspace: Path) -> None:
    paths = ensure_workspace(workspace)
    sync_workspace_library(paths.root)
    if not paths.profile.exists():
        raise click.ClickException(f"Missing profile: {paths.profile}")

    profile = load_profile(paths.profile)
    state = load_state(paths.state)
    plan = build_plan(profile, plan_version=state.plan_version + 1)

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

    click.echo(f"Plan written to {paths.plan}")
    click.echo(f"Coach notes written to {paths.coach_notes}")
    click.echo(f"Check-in template written to {checkin_template_path}")


@main.command("refresh", help="Update the plan using a check-in Markdown file.")
@WORKSPACE_ARGUMENT
@CHECKIN_ARGUMENT
def refresh_command(workspace: Path, checkin: Path) -> None:
    paths = ensure_workspace(workspace)
    sync_workspace_library(paths.root)
    if not paths.profile.exists():
        raise click.ClickException(f"Missing profile: {paths.profile}")
    if not checkin.exists():
        raise click.ClickException(f"Missing check-in: {checkin}")

    profile = load_profile(paths.profile)
    checkin = load_checkin(checkin)
    state = load_state(paths.state)
    plan = build_plan(profile, plan_version=state.plan_version + 1, checkin=checkin)

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


if __name__ == "__main__":
    main()
