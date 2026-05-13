from __future__ import annotations

from datetime import date
from pathlib import Path

from click.testing import CliRunner

from personal_trainer.cli import main
from personal_trainer.models import CheckIn, UserProfile
from personal_trainer.workout_planner import WorkoutPlanBuildResult
from personal_trainer.models import Exercise, WorkoutDay, WorkoutPlan


def _sample_profile() -> UserProfile:
    return UserProfile(
        name="Jordan",
        goal="Build muscle",
        experience_level="intermediate",
        training_days=4,
        session_length_minutes=50,
    )


def _sample_plan_result() -> WorkoutPlanBuildResult:
    return WorkoutPlanBuildResult(
        plan=WorkoutPlan(
            generated_on=date(2026, 5, 13),
            plan_version=3,
            summary="Stay consistent.",
            progression_note="Add reps first.",
            days=[
                WorkoutDay(
                    day_label="Day 1",
                    focus="Full Body",
                    warmup="5 minute bike",
                    warmup_active_seconds=300,
                    exercises=[
                        Exercise(
                            name="Goblet Squat",
                            prescription="3 x 10",
                            notes="Smooth reps.",
                            sets=3,
                            active_seconds=45,
                            rest_between_sets_seconds=90,
                            rest_between_exercises_seconds=120,
                        )
                    ],
                    finisher="Bike sprints",
                    finisher_active_seconds=180,
                    recovery="Walk and stretch",
                    recovery_active_seconds=180,
                )
            ],
            next_checkin_prompt="Check in next Monday.",
            planner_backend="ollama:gpt-oss:20b",
        ),
        review_report={"approved": True},
        reached_max_iterations=False,
    )


def test_init_command_creates_workspace_in_postgres(monkeypatch) -> None:
    created: list[str] = []
    monkeypatch.setattr("personal_trainer.cli.create_workspace", lambda slug: created.append(slug))
    runner = CliRunner()

    result = runner.invoke(main, ["init", "Team Alpha"])

    assert result.exit_code == 0
    assert created == ["team-alpha"]
    assert "ready in Postgres" in result.output


def test_plan_command_reads_db_and_saves_current_plan(monkeypatch) -> None:
    saved: list[tuple[str, WorkoutPlan, UserProfile]] = []
    monkeypatch.setattr("personal_trainer.cli.read_profile", lambda workspace_slug: _sample_profile())
    monkeypatch.setattr(
        "personal_trainer.cli.latest_checkin",
        lambda workspace_slug: CheckIn(
            check_in_date=date(2026, 5, 10),
            workouts_completed=4,
            workouts_planned=4,
            average_difficulty=6,
            energy=7,
            soreness=4,
        ),
    )
    monkeypatch.setattr("personal_trainer.cli.next_plan_version", lambda workspace_slug: 3)
    monkeypatch.setattr(
        "personal_trainer.cli._build_plans",
        lambda **kwargs: (
            [type("Generated", (), {"target": None, "result": _sample_plan_result()})()],
            [type("Generated", (), {"result": _sample_plan_result()})()],
        ),
    )
    monkeypatch.setattr(
        "personal_trainer.cli.save_workout_plan",
        lambda workspace_slug, plan, profile: saved.append((workspace_slug, plan, profile)),
    )
    runner = CliRunner()

    result = runner.invoke(main, ["plan", "team-alpha"])

    assert result.exit_code == 0
    assert "Stored workout plan version 3" in result.output


def test_status_command_reads_workspace_summary(monkeypatch) -> None:
    monkeypatch.setattr("personal_trainer.cli.read_profile", lambda workspace_slug: _sample_profile())
    monkeypatch.setattr("personal_trainer.cli.list_checkins", lambda workspace_slug: [])
    monkeypatch.setattr("personal_trainer.cli.next_plan_version", lambda workspace_slug: 2)
    runner = CliRunner()

    result = runner.invoke(main, ["status", "team-alpha"])

    assert result.exit_code == 0
    assert "Workspace: team-alpha" in result.output
    assert "Next plan version: 2" in result.output


def test_db_commands_delegate_to_shell_and_migrations(monkeypatch) -> None:
    shell_calls: list[str] = []
    monkeypatch.setattr("personal_trainer.cli._run_local_shell_command", lambda command: shell_calls.append(command))
    monkeypatch.setattr("personal_trainer.cli.get_database_url", lambda: "postgresql://local/test")
    monkeypatch.setattr("personal_trainer.cli.run_migrations", lambda database_url: 1)
    runner = CliRunner()

    up_result = runner.invoke(main, ["db", "up"])
    down_result = runner.invoke(main, ["db", "down"])
    destroy_result = runner.invoke(main, ["db", "destroy"])
    setup_result = runner.invoke(main, ["db", "setup"])

    assert up_result.exit_code == 0
    assert down_result.exit_code == 0
    assert destroy_result.exit_code == 0
    assert setup_result.exit_code == 0
    assert shell_calls == [
        "docker compose up -d",
        "docker compose down",
        "docker compose down -v",
    ]
    assert "Applied 1 SQL migration file(s)." in setup_result.output


def test_sync_commands_use_expected_direction(monkeypatch) -> None:
    sync_calls: list[tuple[str, str, tuple[str, ...]]] = []
    monkeypatch.setattr("personal_trainer.cli.get_database_url", lambda: "postgresql://local/test")
    monkeypatch.setattr("personal_trainer.cli.get_prod_database_url", lambda: "postgresql://prod/test")
    monkeypatch.setattr(
        "personal_trainer.cli.sync_tables",
        lambda source, target, tables: sync_calls.append((source, target, tables)),
    )
    runner = CliRunner()

    pull_result = runner.invoke(main, ["sync", "pull-prod"])
    push_result = runner.invoke(main, ["sync", "push-prod"])

    assert pull_result.exit_code == 0
    assert push_result.exit_code == 0
    assert sync_calls == [
        ("postgresql://prod/test", "postgresql://local/test", ("workout_plans", "check_ins", "athlete_profiles", "workspaces")),
        ("postgresql://local/test", "postgresql://prod/test", ("workout_plans", "check_ins", "athlete_profiles", "workspaces")),
    ]


def test_import_commands_delegate_to_importers(tmp_path: Path, monkeypatch) -> None:
    snapshot_export = tmp_path / "recipes.json"
    snapshot_export.write_text("[]", encoding="utf-8")
    monkeypatch.setattr("personal_trainer.cli.get_database_url", lambda: "postgresql://local/test")
    monkeypatch.setattr("personal_trainer.cli.import_filesystem_workspaces", lambda root, database_url: 2)
    monkeypatch.setattr("personal_trainer.cli.import_recipe_snapshots_from_json", lambda path, database_url: 3)
    runner = CliRunner()

    filesystem_result = runner.invoke(main, ["import-filesystem"])
    recipes_result = runner.invoke(main, ["import-blob-recipes", "--snapshot-export", str(snapshot_export)])

    assert filesystem_result.exit_code == 0
    assert recipes_result.exit_code == 0
    assert "Imported 2 workspace(s)" in filesystem_result.output
    assert "Imported 3 saved recipe snapshot(s)." in recipes_result.output
