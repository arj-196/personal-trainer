from __future__ import annotations

from click.testing import CliRunner

from personal_trainer.cli import main
from personal_trainer.markdown_io import load_state


def test_init_and_plan_flow(tmp_path) -> None:
    workspace = tmp_path / "athlete"
    runner = CliRunner()

    result = runner.invoke(main, ["init", str(workspace)])
    assert result.exit_code == 0
    assert (workspace / "profile.md").exists()
    assert (workspace / "exercise_library" / "index.md").exists()

    profile = (workspace / "profile.md").read_text(encoding="utf-8")
    profile = profile.replace("Alex", "Jordan").replace(
        "Days per week: 4", "Days per week: 3"
    )
    (workspace / "profile.md").write_text(profile, encoding="utf-8")

    result = runner.invoke(main, ["plan", str(workspace)])
    assert result.exit_code == 0
    assert (workspace / "plan.md").exists()
    assert (workspace / "coach_notes.md").exists()

    assert "Plan written" in result.output
    assert "coach_notes.md" in result.output
    plan_text = (workspace / "plan.md").read_text(encoding="utf-8")
    assert "exercise_library/images/" in plan_text
    assert "Reference: [Dumbbell Bench Press]" in plan_text


def test_refresh_updates_state(tmp_path) -> None:
    workspace = tmp_path / "athlete"
    runner = CliRunner()

    assert runner.invoke(main, ["init", str(workspace)]).exit_code == 0
    assert runner.invoke(main, ["plan", str(workspace)]).exit_code == 0

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

    result = runner.invoke(main, ["refresh", str(workspace), str(checkin)])
    assert result.exit_code == 0
    state = load_state(workspace / ".trainer" / "state.json")

    assert state.plan_version == 2
    assert state.generated_plans == 2
    assert state.last_check_in == "2026-03-30"
    assert "Plan version: 2" in (workspace / "plan.md").read_text(encoding="utf-8")
    assert (workspace / "exercise_library" / "goblet-squat.md").exists()


def test_status_runs(tmp_path) -> None:
    workspace = tmp_path / "athlete"
    runner = CliRunner()

    assert runner.invoke(main, ["init", str(workspace)]).exit_code == 0
    result = runner.invoke(main, ["status", str(workspace)])
    assert result.exit_code == 0
    assert "Profile exists: yes" in result.output
