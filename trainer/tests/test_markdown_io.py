from __future__ import annotations

from datetime import date

from personal_trainer.markdown_io import render_plan
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
                exercises=[
                    Exercise(
                        name="Dumbbell Bench Press",
                        prescription="3 sets x 8 reps",
                        notes="Leave 2 reps in reserve.",
                    )
                ],
                finisher="Easy bike.",
                recovery="Hydrate.",
            )
        ],
    )

    rendered = render_plan(plan, profile)

    assert (
        '<img src="exercise_library/images/dumbbell-bench-press.png" '
        'alt="Dumbbell Bench Press" '
        'style="display: block; max-width: 240px; width: 100%; height: auto;" />'
    ) in rendered
    assert (
        "\nReference: [Dumbbell Bench Press](exercise_library/dumbbell-bench-press.md)\n\n- Finisher:"
        in rendered
    )
