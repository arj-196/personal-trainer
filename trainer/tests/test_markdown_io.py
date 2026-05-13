from __future__ import annotations

import json
from datetime import date

from personal_trainer.markdown_io import (
    load_workout_plan,
    read_planned_workouts_from_plan_json,
    render_checkin_template,
    render_plan,
    render_plan_json,
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


def _sample_plan() -> WorkoutPlan:
    return WorkoutPlan(
        generated_on=date(2026, 4, 12),
        plan_version=9,
        summary="Simple repeatable week.",
        progression_note="Add reps before load.",
        days=[
            WorkoutDay(
                day_label="Day 1",
                focus="Upper body",
                warmup="Easy bike",
                warmup_active_seconds=300,
                exercises=[
                    Exercise(
                        name="Dumbbell Bench Press",
                        prescription="3 sets x 8 reps",
                        notes="Control the lowering.",
                        sets=3,
                        active_seconds=45,
                        rest_between_sets_seconds=75,
                        rest_between_exercises_seconds=120,
                    )
                ],
                finisher="Easy bike",
                finisher_active_seconds=180,
                recovery="Stretch",
                recovery_active_seconds=180,
            )
        ],
        next_checkin_prompt="Report recovery.",
        planner_backend="openai/gpt-5.4",
        coach_notes_focus=["Keep reps clean."],
        coach_notes_cautions=["Stop if pain rises."],
    )


def _sample_profile() -> UserProfile:
    return UserProfile(
        name="Jordan",
        goal="Build muscle",
        session_length_minutes=45,
    )


def _write_plan_files(tmp_path, plan: WorkoutPlan, profile: UserProfile) -> tuple:
    plan_json = tmp_path / "plan.json"
    plan_markdown = tmp_path / "plan.md"
    plan_json.write_text(render_plan_json(plan, profile), encoding="utf-8")
    plan_markdown.write_text(render_plan(plan, profile), encoding="utf-8")
    return plan_json, plan_markdown


def test_load_workout_plan_validates_matching_json_and_markdown(tmp_path) -> None:
    profile = _sample_profile()
    plan_json, plan_markdown = _write_plan_files(tmp_path, _sample_plan(), profile)

    loaded = load_workout_plan(plan_json, plan_markdown, profile)

    assert loaded.plan_version == 9
    assert loaded.generated_on == date(2026, 4, 12)
    assert loaded.days[0].exercises[0].active_seconds == 45
    assert loaded.coach_notes_focus == ["Keep reps clean."]


def test_load_workout_plan_fails_when_raw_plan_missing(tmp_path) -> None:
    profile = _sample_profile()
    plan_json = tmp_path / "plan.json"
    plan_markdown = tmp_path / "plan.md"
    plan_json.write_text(json.dumps({"days": []}), encoding="utf-8")
    plan_markdown.write_text("", encoding="utf-8")

    try:
        load_workout_plan(plan_json, plan_markdown, profile)
    except ValueError as error:
        assert "missing rawPlan" in str(error)
    else:
        raise AssertionError("Expected missing rawPlan to fail")


def test_load_workout_plan_fails_when_markdown_does_not_match(tmp_path) -> None:
    profile = _sample_profile()
    plan_json, plan_markdown = _write_plan_files(tmp_path, _sample_plan(), profile)
    plan_markdown.write_text("# Different Plan\n", encoding="utf-8")

    try:
        load_workout_plan(plan_json, plan_markdown, profile)
    except ValueError as error:
        assert "does not match" in str(error)
    else:
        raise AssertionError("Expected mismatched Markdown to fail")


def test_load_workout_plan_fails_when_only_one_plan_file_exists(tmp_path) -> None:
    profile = _sample_profile()
    plan_json, plan_markdown = _write_plan_files(tmp_path, _sample_plan(), profile)
    plan_markdown.unlink()

    try:
        load_workout_plan(plan_json, plan_markdown, profile)
    except ValueError as error:
        assert "Markdown is missing" in str(error)
    else:
        raise AssertionError("Expected partial Workout Plan files to fail")
