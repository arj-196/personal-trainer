from __future__ import annotations

import json
from datetime import date

from personal_trainer.markdown_io import (
    read_planned_workouts_from_plan_json,
    render_checkin_template,
    render_plan,
)
from personal_trainer.models import Exercise, UserProfile, WorkoutDay, WorkoutPlan


def test_render_plan_renders_reference_image_as_block() -> None:
    profile = UserProfile(
        name="Jordan",
        goal="Build muscle",
        session_length_minutes=45,
    )
    plan = WorkoutPlan(
        generated_on=date(2026, 4, 1),
        plan_version=1,
        summary="Simple week.",
        progression_note="Add reps first.",
        next_checkin_prompt="Log recovery.",
        planner_backend="ollama/gpt-oss:20b",
        days=[
            WorkoutDay(
                day_label="Day 1",
                focus="Upper body",
                warmup="5 minutes easy cardio.",
                warmup_active_seconds=300,
                exercises=[
                    Exercise(
                        name="Dumbbell Bench Press",
                        prescription="3 sets x 8 reps",
                        notes="Leave 2 reps in reserve.",
                        sets=3,
                        active_seconds=45,
                        rest_between_sets_seconds=75,
                        rest_between_exercises_seconds=120,
                    )
                ],
                finisher="Easy bike.",
                finisher_active_seconds=480,
                recovery="Hydrate.",
                recovery_active_seconds=300,
            )
        ],
    )

    rendered = render_plan(plan, profile)

    assert (
        '<img src="https://wger.de/media/exercise-images/1676/ac441fa8-cf11-45a5-9633-18ae49fb9320.webp" '
        'alt="Dumbbell Bench Press" '
        'style="display: block; max-width: 240px; width: 100%; height: auto;" />'
    ) in rendered
    assert "\n- Finisher:" in rendered


def test_read_planned_workouts_from_plan_json_uses_days_length(tmp_path) -> None:
    plan_json = tmp_path / "plan.json"
    plan_json.write_text(json.dumps({"days": [{}, {}, {}, {}]}), encoding="utf-8")

    assert read_planned_workouts_from_plan_json(plan_json) == 4


def test_read_planned_workouts_from_plan_json_returns_zero_when_missing(tmp_path) -> None:
    assert read_planned_workouts_from_plan_json(tmp_path / "missing-plan.json") == 0


def test_render_checkin_template_uses_date_and_planned_defaults() -> None:
    rendered = render_checkin_template(
        checkin_date=date(2026, 4, 12),
        workouts_planned=5,
    )

    assert "- Date: 2026-04-12" in rendered
    assert "- Workouts completed: 5" in rendered
    assert "- Workouts planned: 5" in rendered
    assert "personal-trainer plan <workspace>" in rendered
    assert "personal-trainer refresh" not in rendered
