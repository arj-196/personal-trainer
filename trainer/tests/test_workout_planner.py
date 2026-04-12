from __future__ import annotations

from datetime import date

import pytest

from personal_trainer.models import CheckIn, UserProfile
from personal_trainer.workout_planner import (
    TrainerPlanDraft,
    TrainerPlanRequest,
    WorkoutPlannerError,
    _build_system_prompt,
    _build_user_prompt,
    build_plan,
    build_plan_with_review,
)


def _valid_plan_payload(summary: str = "Keep the week simple and repeatable.") -> dict[str, object]:
    return {
        "summary": summary,
        "progression_note": "Add a rep before load.",
        "next_checkin_prompt": "Log adherence and recovery.",
        "coach_notes_focus": [
            "Leave 1-2 reps in reserve on main lifts.",
            "Keep warmups intentional.",
        ],
        "coach_notes_cautions": [
            "Back off any movement that causes sharp pain.",
        ],
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
                    }
                ],
                "finisher": "Easy walk.",
                "finisher_active_seconds": 300,
                "recovery": "Hydrate and sleep well.",
                "recovery_active_seconds": 240,
            }
        ],
    }


class StaticAgent:
    def __init__(
        self,
        payload: dict[str, object],
        provider: str = "ollama",
        model_name: str = "gpt-oss:20b",
        arnold_approvals: list[bool] | None = None,
        doctor_mike_approvals: list[bool] | None = None,
        revision_payloads: list[dict[str, object]] | None = None,
    ) -> None:
        self.payload = payload
        self.provider = provider
        self.model_name = model_name
        self.requests: list[TrainerPlanRequest] = []
        self.step_names: list[str] = []
        self.revision_prompts: dict[str, str] = {}
        self.arnold_approvals = arnold_approvals or [True]
        self.doctor_mike_approvals = doctor_mike_approvals or [True]
        self.revision_payloads = revision_payloads or [payload]

    def run_json_step(
        self,
        request: TrainerPlanRequest,
        *,
        system_prompt: str,
        user_prompt: str,
        schema: dict[str, object],
        step_name: str,
        metadata: dict[str, object],
    ) -> TrainerPlanDraft:
        self.requests.append(request)
        self.step_names.append(step_name)

        if step_name == "planner_initial":
            return TrainerPlanDraft(
                payload=self.payload,
                provider=self.provider,
                model_name=self.model_name,
            )

        if step_name.startswith("planner_revision_iter_"):
            self.revision_prompts[step_name] = user_prompt
            iter_index = int(step_name.rsplit("_", 1)[-1]) - 1
            payload_index = min(iter_index, len(self.revision_payloads) - 1)
            return TrainerPlanDraft(
                payload=self.revision_payloads[payload_index],
                provider=self.provider,
                model_name=self.model_name,
            )

        if step_name.startswith("review_arnold_iter_"):
            iter_index = int(step_name.rsplit("_", 1)[-1]) - 1
            approved = self.arnold_approvals[min(iter_index, len(self.arnold_approvals) - 1)]
            return TrainerPlanDraft(
                payload={
                    "approved": approved,
                    "blocking_issues": [] if approved else ["Add more chest/back volume."],
                    "suggested_changes": ["Increase weekly back pulling volume."],
                    "reasoning_summary": "Bodybuilding quality and progression check.",
                },
                provider=self.provider,
                model_name=self.model_name,
            )

        if step_name.startswith("review_doctor_mike_iter_"):
            iter_index = int(step_name.rsplit("_", 1)[-1]) - 1
            approved = self.doctor_mike_approvals[
                min(iter_index, len(self.doctor_mike_approvals) - 1)
            ]
            return TrainerPlanDraft(
                payload={
                    "approved": approved,
                    "blocking_issues": [] if approved else ["Reduce knee-irritating movement dosage."],
                    "suggested_changes": ["Lower lower-body loading if pain rises."],
                    "reasoning_summary": "Medical safety and recovery check.",
                },
                provider=self.provider,
                model_name=self.model_name,
            )

        raise AssertionError(f"Unexpected step name: {step_name}")


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
    payload = _valid_plan_payload(
        summary=(
            "The week prioritizes productive upper-body work while keeping lower-body loading knee-friendly."
        )
    )
    agent = StaticAgent(payload)

    plan = build_plan(profile, plan_version=4, checkin=checkin, agent=agent)

    assert agent.requests[0].profile.name == "Jordan"
    assert plan.plan_version == 4
    assert plan.planner_backend == "ollama/gpt-oss:20b"
    assert plan.days[0].exercises[0].prescription == "3 sets x 8 reps"
    assert plan.days[0].exercises[0].sets == 3
    assert plan.days[0].warmup_active_seconds == 300
    assert plan.coach_notes_focus == [
        "Leave 1-2 reps in reserve on main lifts.",
        "Keep warmups intentional.",
    ]
    assert agent.step_names == [
        "planner_initial",
        "review_arnold_iter_1",
        "review_doctor_mike_iter_1",
    ]


def test_build_plan_rejects_invalid_structured_output() -> None:
    profile = UserProfile(name="Jordan")
    agent = StaticAgent({"days": []})

    with pytest.raises(WorkoutPlannerError, match="at least one training day"):
        build_plan(profile, plan_version=1, agent=agent)


def test_build_plan_records_openai_backend() -> None:
    profile = UserProfile(name="Jordan")
    agent = StaticAgent(
        _valid_plan_payload(),
        provider="openai",
        model_name="gpt-5.4-mini",
    )

    plan = build_plan(profile, plan_version=2, agent=agent)

    assert plan.planner_backend == "openai/gpt-5.4-mini"


def test_build_plan_rejects_non_positive_timing_values() -> None:
    profile = UserProfile(name="Jordan")
    payload = _valid_plan_payload()
    exercises = payload["days"][0]["exercises"]  # type: ignore[index]
    exercises[0]["active_seconds"] = 0  # type: ignore[index]
    agent = StaticAgent(payload)

    with pytest.raises(WorkoutPlannerError, match="positive integer 'active_seconds'"):
        build_plan(profile, plan_version=1, agent=agent)


def test_build_plan_review_stops_early_when_both_personas_approve() -> None:
    profile = UserProfile(name="Jordan")
    agent = StaticAgent(_valid_plan_payload())

    result = build_plan_with_review(profile, plan_version=3, agent=agent)

    assert result.reached_max_iterations is False
    assert result.review_report["final_status"] == "approved"
    assert result.review_report["iterations_ran"] == 1
    assert "planner_revision_iter_1" not in agent.step_names


def test_build_plan_review_iterates_until_personas_approve() -> None:
    profile = UserProfile(name="Jordan")
    initial = _valid_plan_payload("Initial draft")
    revised = _valid_plan_payload("Revised draft")
    agent = StaticAgent(
        initial,
        arnold_approvals=[False, True],
        doctor_mike_approvals=[True, True],
        revision_payloads=[revised],
    )

    result = build_plan_with_review(
        profile,
        plan_version=3,
        agent=agent,
        max_review_iterations=5,
    )

    assert result.reached_max_iterations is False
    assert result.plan.summary == "Revised draft"
    assert result.review_report["iterations_ran"] == 2
    assert "planner_revision_iter_1" in agent.step_names
    assert "review_arnold_iter_2" in agent.step_names
    assert "review_doctor_mike_iter_2" in agent.step_names


def test_build_plan_review_marks_max_iteration_exhaustion() -> None:
    profile = UserProfile(name="Jordan")
    agent = StaticAgent(
        _valid_plan_payload("Still problematic"),
        arnold_approvals=[False, False],
        doctor_mike_approvals=[False, False],
    )

    result = build_plan_with_review(
        profile,
        plan_version=3,
        agent=agent,
        max_review_iterations=2,
    )

    assert result.reached_max_iterations is True
    assert result.review_report["final_status"] == "max_iterations_reached"
    assert result.review_report["unresolved_personas"] == [
        "Arnold Schwarzenegger",
        "Doctor Mike",
    ]


def test_build_plan_revision_prompt_includes_both_persona_feedback() -> None:
    profile = UserProfile(name="Jordan")
    agent = StaticAgent(
        _valid_plan_payload(),
        arnold_approvals=[False, True],
        doctor_mike_approvals=[False, True],
        revision_payloads=[_valid_plan_payload("Revised after both reviewers")],
    )

    build_plan_with_review(
        profile,
        plan_version=3,
        agent=agent,
        max_review_iterations=3,
    )

    prompt = agent.revision_prompts["planner_revision_iter_1"]
    assert "Add more chest/back volume." in prompt
    assert "Reduce knee-irritating movement dosage." in prompt


def test_build_user_prompt_renders_template_with_payload_json() -> None:
    profile = UserProfile(name="Jordan", training_days=3, session_length_minutes=45)
    request = TrainerPlanRequest(profile=profile, plan_version=5)

    prompt = _build_user_prompt(request)

    assert "Create the athlete's best customized workout plan for the next week." in prompt
    assert "Planning context JSON:" in prompt
    assert '"target_plan_version": 5' in prompt
    assert '"name": "Jordan"' in prompt


def test_build_system_prompt_renders_template() -> None:
    prompt = _build_system_prompt()

    assert "You are an elite personal trainer and strength coach." in prompt
    assert "Return only JSON that matches the provided schema." in prompt
