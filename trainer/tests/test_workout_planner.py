from __future__ import annotations

from datetime import date

import pytest

from personal_trainer.models import CheckIn, UserProfile
from personal_trainer.workout_planner import (
    TrainerPlanDraft,
    TrainerPlanRequest,
    WorkoutPlannerError,
    build_plan,
)


class StaticAgent:
    def __init__(
        self,
        payload: dict[str, object],
        provider: str = "ollama",
        model_name: str = "gpt-oss:20b",
    ) -> None:
        self.payload = payload
        self.provider = provider
        self.model_name = model_name
        self.requests: list[TrainerPlanRequest] = []

    def generate_weekly_plan(self, request: TrainerPlanRequest) -> TrainerPlanDraft:
        self.requests.append(request)
        return TrainerPlanDraft(
            payload=self.payload,
            provider=self.provider,
            model_name=self.model_name,
        )


def test_build_plan_uses_structured_agent_output() -> None:
    profile = UserProfile(
        name="Jordan",
        goal="Build muscle while protecting my knee",
        training_days=3,
        session_length_minutes=50,
        equipment=["Dumbbells", "Bench", "Pull-up bar"],
        limitations=["Left knee irritation"],
        preferred_focus=["Upper body strength"],
    )
    checkin = CheckIn(
        check_in_date=date(2026, 3, 30),
        workouts_completed=3,
        workouts_planned=3,
        average_difficulty=6,
        energy=8,
        soreness=3,
        wins=["Stayed consistent"],
        struggles=["Knee felt stiff on lunges"],
    )
    agent = StaticAgent(
        {
            "summary": "The week prioritizes productive upper-body work while keeping lower-body loading knee-friendly.",
            "progression_note": "Add a rep before load whenever the top end of the range feels clean.",
            "next_checkin_prompt": "Log adherence, energy, knee symptoms, and which lifts felt easiest to progress.",
            "coach_notes_focus": [
                "Keep 1-2 reps in reserve on the main lifts.",
                "Treat the warm-ups as movement prep, not throwaway volume.",
            ],
            "coach_notes_cautions": [
                "If the knee pain rises during squatting, shorten the range and note it in the check-in."
            ],
            "days": [
                {
                    "day_label": "Day 1",
                    "focus": "Upper body strength",
                    "warmup": "5 minutes easy bike, shoulder circles, and 2 ramp-up sets for the first press.",
                    "warmup_active_seconds": 300,
                    "exercises": [
                        {
                            "name": "Dumbbell Bench Press",
                            "prescription": "4 sets x 6-8 reps @ RPE 7",
                            "notes": "Pause briefly on the chest and keep the last rep clean.",
                            "sets": 4,
                            "active_seconds": 50,
                            "rest_between_sets_seconds": 90,
                            "rest_between_exercises_seconds": 120,
                            "tempo_label": "controlled",
                        },
                        {
                            "name": "1-Arm Dumbbell Row",
                            "prescription": "4 sets x 8-10 reps",
                            "notes": "Drive the elbow back without twisting the torso.",
                            "sets": 4,
                            "active_seconds": 45,
                            "rest_between_sets_seconds": 75,
                            "rest_between_exercises_seconds": 120,
                            "tempo_label": "steady",
                        },
                    ],
                    "finisher": "8 minutes easy-moderate bike intervals.",
                    "finisher_active_seconds": 480,
                    "recovery": "Walk for 10 minutes later in the day and monitor knee stiffness.",
                    "recovery_active_seconds": 300,
                },
                {
                    "day_label": "Day 2",
                    "focus": "Lower body technique and trunk",
                    "warmup": "Bike 5 minutes, hip mobility, then bodyweight squats to a comfortable depth.",
                    "warmup_active_seconds": 300,
                    "exercises": [
                        {
                            "name": "Squat to Bench",
                            "prescription": "3 sets x 8 reps @ easy-moderate effort",
                            "notes": "Stay in the pain-free range and control the descent.",
                            "sets": 3,
                            "active_seconds": 45,
                            "rest_between_sets_seconds": 90,
                            "rest_between_exercises_seconds": 120,
                            "tempo_label": "controlled",
                        },
                        {
                            "name": "Glute Bridge",
                            "prescription": "3 sets x 12 reps",
                            "notes": "Pause for a full second at the top.",
                            "sets": 3,
                            "active_seconds": 40,
                            "rest_between_sets_seconds": 75,
                            "rest_between_exercises_seconds": 120,
                            "tempo_label": "steady",
                        },
                    ],
                    "finisher": "10 minutes brisk walking.",
                    "finisher_active_seconds": 600,
                    "recovery": "Keep the next day easy if knee soreness lingers more than 24 hours.",
                    "recovery_active_seconds": 300,
                },
            ],
        }
    )

    plan = build_plan(profile, plan_version=4, checkin=checkin, agent=agent)

    assert agent.requests[0].profile.name == "Jordan"
    assert plan.plan_version == 4
    assert plan.planner_backend == "ollama/gpt-oss:20b"
    assert plan.days[0].exercises[0].prescription == "4 sets x 6-8 reps @ RPE 7"
    assert plan.days[0].exercises[0].sets == 4
    assert plan.days[0].warmup_active_seconds == 300
    assert plan.coach_notes_focus == [
        "Keep 1-2 reps in reserve on the main lifts.",
        "Treat the warm-ups as movement prep, not throwaway volume.",
    ]


def test_build_plan_rejects_invalid_structured_output() -> None:
    profile = UserProfile(name="Jordan")
    agent = StaticAgent({"days": []})

    with pytest.raises(WorkoutPlannerError, match="at least one training day"):
        build_plan(profile, plan_version=1, agent=agent)


def test_build_plan_records_openai_backend() -> None:
    profile = UserProfile(name="Jordan")
    agent = StaticAgent(
        {
            "summary": "Keep the week simple and repeatable.",
            "progression_note": "Add a rep before load.",
            "next_checkin_prompt": "Log adherence and recovery.",
            "days": [
                {
                    "day_label": "Day 1",
                    "focus": "Full body",
                    "warmup": "5 minutes easy cardio.",
                    "warmup_active_seconds": 300,
                    "exercises": [
                        {
                            "name": "Push-Up",
                            "prescription": "3 sets x 8 reps",
                            "notes": "Leave 2 reps in reserve.",
                            "sets": 3,
                            "active_seconds": 35,
                            "rest_between_sets_seconds": 75,
                            "rest_between_exercises_seconds": 120,
                            "tempo_label": "steady",
                        }
                    ],
                    "finisher": "Easy walk.",
                    "finisher_active_seconds": 300,
                    "recovery": "Hydrate and sleep well.",
                    "recovery_active_seconds": 240,
                }
            ],
        },
        provider="openai",
        model_name="gpt-5.4-mini",
    )

    plan = build_plan(profile, plan_version=2, agent=agent)

    assert plan.planner_backend == "openai/gpt-5.4-mini"


def test_build_plan_rejects_non_positive_timing_values() -> None:
    profile = UserProfile(name="Jordan")
    agent = StaticAgent(
        {
            "summary": "Keep the week simple.",
            "progression_note": "Add reps before load.",
            "next_checkin_prompt": "Log adherence and recovery.",
            "days": [
                {
                    "day_label": "Day 1",
                    "focus": "Full body",
                    "warmup": "5 minutes easy cardio.",
                    "warmup_active_seconds": 300,
                    "exercises": [
                        {
                            "name": "Push-Up",
                            "prescription": "3 sets x 8 reps",
                            "notes": "Leave 2 reps in reserve.",
                            "sets": 3,
                            "active_seconds": 0,
                            "rest_between_sets_seconds": 75,
                            "rest_between_exercises_seconds": 120,
                            "tempo_label": "steady",
                        }
                    ],
                    "finisher": "Easy walk.",
                    "finisher_active_seconds": 300,
                    "recovery": "Hydrate and sleep well.",
                    "recovery_active_seconds": 240,
                }
            ],
        }
    )

    with pytest.raises(WorkoutPlannerError, match="positive integer 'active_seconds'"):
        build_plan(profile, plan_version=1, agent=agent)
