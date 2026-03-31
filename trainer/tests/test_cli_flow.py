from __future__ import annotations

from click.testing import CliRunner

from personal_trainer.blob_sync import BlobPublishResult
from personal_trainer.cli import main
from personal_trainer.markdown_io import load_state


def test_init_and_plan_flow(tmp_path, monkeypatch) -> None:
    workspaces_root = tmp_path / "workspaces"
    workspace = workspaces_root / "athlete"
    monkeypatch.setattr("personal_trainer.cli.WORKSPACES_ROOT", workspaces_root)
    runner = CliRunner()

    result = runner.invoke(main, ["init", "athlete"])
    assert result.exit_code == 0
    assert (workspace / "profile.md").exists()
    assert (workspace / "exercise_library" / "index.md").exists()

    profile = (workspace / "profile.md").read_text(encoding="utf-8")
    profile = profile.replace("Albert", "Jordan").replace(
        "Days per week: 4", "Days per week: 3"
    )
    (workspace / "profile.md").write_text(profile, encoding="utf-8")

    result = runner.invoke(main, ["plan", "athlete"])
    assert result.exit_code == 0
    assert (workspace / "plan.md").exists()
    assert (workspace / "coach_notes.md").exists()

    assert "Plan written" in result.output
    assert "coach_notes.md" in result.output
    plan_text = (workspace / "plan.md").read_text(encoding="utf-8")
    assert "exercise_library/images/" in plan_text
    assert "Reference: [Dumbbell Bench Press]" in plan_text


def test_refresh_updates_state(tmp_path, monkeypatch) -> None:
    workspaces_root = tmp_path / "workspaces"
    workspace = workspaces_root / "athlete"
    monkeypatch.setattr("personal_trainer.cli.WORKSPACES_ROOT", workspaces_root)
    runner = CliRunner()

    assert runner.invoke(main, ["init", "athlete"]).exit_code == 0
    assert runner.invoke(main, ["plan", "athlete"]).exit_code == 0

    checkin = workspace / "checkins" / "2026-03-30-checkin.md"
    checkin.write_text(
        """# Weekly Check-In

## Summary
- Date: 2026-03-30
- Workouts completed: 3
- Workouts planned: 3
- Average difficulty (1-10): 6
- Energy (1-10): 8
- Soreness (1-10): 3
- Body weight kg: 80.5

## Wins
- Felt strong on pressing work.

## Struggles
- None.

## Notes
- Recovery was solid.
""",
        encoding="utf-8",
    )

    result = runner.invoke(main, ["refresh", "athlete", checkin.name])
    assert result.exit_code == 0
    state = load_state(workspace / ".trainer" / "state.json")

    assert state.plan_version == 2
    assert state.generated_plans == 2
    assert state.last_check_in == "2026-03-30"
    assert "Plan version: 2" in (workspace / "plan.md").read_text(encoding="utf-8")
    assert (workspace / "exercise_library" / "goblet-squat.md").exists()


def test_status_runs(tmp_path, monkeypatch) -> None:
    workspaces_root = tmp_path / "workspaces"
    workspace = workspaces_root / "athlete"
    monkeypatch.setattr("personal_trainer.cli.WORKSPACES_ROOT", workspaces_root)
    runner = CliRunner()

    assert runner.invoke(main, ["init", "athlete"]).exit_code == 0
    result = runner.invoke(main, ["status", "athlete"])
    assert result.exit_code == 0
    assert "Profile exists: yes" in result.output


def test_publish_web_command_reports_upload_summary(tmp_path, monkeypatch) -> None:
    workspaces_root = tmp_path / "workspaces"
    workspace = workspaces_root / "athlete"
    workspace.mkdir(parents=True)
    monkeypatch.setattr("personal_trainer.cli.WORKSPACES_ROOT", workspaces_root)
    monkeypatch.setattr(
        "personal_trainer.cli.publish_workspace_to_blob",
        lambda *args, **kwargs: BlobPublishResult(
            workspace="athlete",
            prefix="pt-prod",
            access="private",
            workspace_files_uploaded=4,
            library_files_uploaded=2,
            remote_files_deleted=3,
        ),
    )
    runner = CliRunner()

    result = runner.invoke(main, ["publish-web", "athlete", "--prefix", "pt-prod"])

    assert result.exit_code == 0
    assert "Published workspace 'athlete' to Blob prefix 'pt-prod'" in result.output
    assert "Workspace files uploaded: 4" in result.output
    assert "Library files uploaded: 2" in result.output


def test_recipes_command_suggests_goal_aligned_meals(tmp_path, monkeypatch) -> None:
    workspaces_root = tmp_path / "workspaces"
    workspace = workspaces_root / "athlete"
    monkeypatch.setattr("personal_trainer.cli.WORKSPACES_ROOT", workspaces_root)
    runner = CliRunner()

    assert runner.invoke(main, ["init", "athlete"]).exit_code == 0

    profile = (workspace / "profile.md").read_text(encoding="utf-8")
    profile = profile.replace(
        "Build muscle and improve conditioning", "Build muscle"
    )
    (workspace / "profile.md").write_text(profile, encoding="utf-8")

    result = runner.invoke(
        main,
        ["recipes", "athlete", "--ingredients", "chicken, rice, broccoli, garlic"],
    )

    assert result.exit_code == 0
    assert "Recipe suggestions for athlete" in result.output
    assert "Chicken, Rice, and Broccoli Bowl" in result.output
    assert "[strong fit]" in result.output
