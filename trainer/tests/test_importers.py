from __future__ import annotations

from datetime import date
from pathlib import Path

import pytest

from personal_trainer.importers import import_filesystem_workspaces
from personal_trainer.markdown_io import render_plan, render_plan_json
from personal_trainer.models import Exercise, UserProfile, WorkoutDay, WorkoutPlan


def _profile_markdown(name: str = "Jordan") -> str:
    return f"""# Athlete Profile

## Basics
- Name: {name}
- Age: 34
- Sex: male
- Height cm: 178
- Weight kg: 82

## Goals
- Primary goal: Build muscle
- Experience level: intermediate
- Cardio preference: bike

## Schedule
- Days per week: 4
- Session length minutes: 50

## Equipment
- Dumbbells

## Limitations
- 

## Preferred Focus
- Arms

## Notes
- Train before work.
"""


def _checkin_markdown() -> str:
    return """# Weekly Check-In

## Summary
- Date: 2026-04-12
- Workouts completed: 3
- Workouts planned: 4
- Average difficulty (1-10): 6
- Energy (1-10): 7
- Soreness (1-10): 4
- Body weight kg: 82

## Wins
- Consistent training.

## Struggles
- Low sleep.

## Notes
- Keep sessions short.
"""


def _sample_profile() -> UserProfile:
    return UserProfile(
        name="Jordan",
        goal="Build muscle",
        experience_level="intermediate",
        training_days=4,
        session_length_minutes=50,
        equipment=["Dumbbells"],
        limitations=[""],
        preferred_focus=["Arms"],
        notes=["Train before work."],
    )


def _sample_plan() -> WorkoutPlan:
    return WorkoutPlan(
        generated_on=date(2026, 4, 12),
        plan_version=2,
        summary="Simple week.",
        progression_note="Add reps first.",
        days=[
            WorkoutDay(
                day_label="Day 1",
                focus="Full body",
                warmup="Easy bike",
                warmup_active_seconds=300,
                exercises=[
                    Exercise(
                        name="Goblet Squat",
                        prescription="3 x 10",
                        notes="Smooth reps.",
                        sets=3,
                        active_seconds=45,
                        rest_between_sets_seconds=75,
                        rest_between_exercises_seconds=120,
                    )
                ],
                finisher="Bike",
                finisher_active_seconds=180,
                recovery="Stretch",
                recovery_active_seconds=180,
            )
        ],
        next_checkin_prompt="Report recovery.",
        planner_backend="openai/gpt-5.4",
        coach_notes_focus=["Stay consistent."],
        coach_notes_cautions=["Avoid pain."],
    )


def _write_workspace(
    workspaces_root: Path,
    *,
    slug: str = "wk_jordan",
    include_plan: bool = True,
) -> Path:
    workspace = workspaces_root / slug
    checkins_dir = workspace / "checkins"
    checkins_dir.mkdir(parents=True)
    (workspace / "profile.md").write_text(_profile_markdown(), encoding="utf-8")
    (checkins_dir / "2026-04-12-checkin.md").write_text(
        _checkin_markdown(),
        encoding="utf-8",
    )
    if include_plan:
        profile = _sample_profile()
        plan = _sample_plan()
        (workspace / "plan.json").write_text(
            render_plan_json(plan, profile),
            encoding="utf-8",
        )
        (workspace / "plan.md").write_text(render_plan(plan, profile), encoding="utf-8")
    return workspace


def test_import_filesystem_workspaces_imports_profile_checkins_and_plan(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _write_workspace(tmp_path)
    created: list[str] = []
    profiles: list[tuple[str, UserProfile]] = []
    checkins: list[tuple[str, date]] = []
    plans: list[tuple[str, WorkoutPlan, UserProfile]] = []

    monkeypatch.setattr(
        "personal_trainer.importers.create_workspace",
        lambda slug, database_url=None: created.append(slug),
    )
    monkeypatch.setattr(
        "personal_trainer.importers.upsert_profile",
        lambda slug, profile, database_url=None: profiles.append((slug, profile)),
    )
    monkeypatch.setattr(
        "personal_trainer.importers.upsert_checkin",
        lambda slug, checkin, database_url=None: checkins.append(
            (slug, checkin.check_in_date)
        ),
    )
    monkeypatch.setattr(
        "personal_trainer.importers.insert_imported_workout_plan",
        lambda slug, plan, profile, database_url=None: plans.append(
            (slug, plan, profile)
        ),
    )

    imported = import_filesystem_workspaces(tmp_path, database_url="postgresql://test")

    assert imported == 1
    assert created == ["wk_jordan"]
    assert profiles[0][0] == "wk_jordan"
    assert profiles[0][1].name == "Jordan"
    assert checkins == [("wk_jordan", date(2026, 4, 12))]
    assert plans[0][0] == "wk_jordan"
    assert plans[0][1].plan_version == 2
    assert plans[0][2].name == "Jordan"


def test_import_filesystem_workspaces_imports_workspace_without_plan(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _write_workspace(tmp_path, include_plan=False)
    plans: list[WorkoutPlan] = []

    monkeypatch.setattr(
        "personal_trainer.importers.create_workspace",
        lambda slug, database_url=None: None,
    )
    monkeypatch.setattr(
        "personal_trainer.importers.upsert_profile",
        lambda slug, profile, database_url=None: None,
    )
    monkeypatch.setattr(
        "personal_trainer.importers.upsert_checkin",
        lambda slug, checkin, database_url=None: None,
    )
    monkeypatch.setattr(
        "personal_trainer.importers.insert_imported_workout_plan",
        lambda slug, plan, profile, database_url=None: plans.append(plan),
    )

    imported = import_filesystem_workspaces(tmp_path, database_url="postgresql://test")

    assert imported == 1
    assert plans == []


def test_import_filesystem_workspaces_surfaces_existing_plan_conflict(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _write_workspace(tmp_path)

    monkeypatch.setattr(
        "personal_trainer.importers.create_workspace",
        lambda slug, database_url=None: None,
    )
    monkeypatch.setattr(
        "personal_trainer.importers.upsert_profile",
        lambda slug, profile, database_url=None: None,
    )
    monkeypatch.setattr(
        "personal_trainer.importers.upsert_checkin",
        lambda slug, checkin, database_url=None: None,
    )
    monkeypatch.setattr(
        "personal_trainer.importers.insert_imported_workout_plan",
        lambda slug, plan, profile, database_url=None: (_ for _ in ()).throw(
            RuntimeError("Workout Plan version 2 already exists")
        ),
    )

    with pytest.raises(RuntimeError, match="already exists"):
        import_filesystem_workspaces(tmp_path, database_url="postgresql://test")
