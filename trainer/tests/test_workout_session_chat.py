from __future__ import annotations

import json

import pytest

from personal_trainer.models import UserProfile
from personal_trainer.llm_client import LlmError
from personal_trainer.workout_session_chat import (
    CHAT_RESPONSE_SCHEMA,
    WorkoutSessionChatError,
    WorkoutSessionChatRequest,
    WorkoutSessionChatResponse,
    WorkoutSessionChatTurn,
    answer_workout_session_chat,
    find_workout_day,
)


class StaticChatClient:
    def __init__(self, payload: dict[str, str] | None = None, error: Exception | None = None) -> None:
        self.payload = payload or {
            "arnold_response": "Keep the reps clean and controlled.",
        }
        self.error = error
        self.calls: list[dict[str, object]] = []

    def chat_json(self, **kwargs):
        self.calls.append(kwargs)
        if self.error:
            raise self.error
        return self.payload


def _profile() -> UserProfile:
    return UserProfile(
        name="Jordan",
        goal="Build muscle while protecting my knee",
        experience_level="intermediate",
        training_days=4,
        session_length_minutes=50,
        equipment=["Dumbbells", "Bench"],
        limitations=["Left knee irritation"],
        preferred_focus=["Upper body"],
    )


def _rendered_plan() -> dict[str, object]:
    return {
        "title": "Week 4 Plan",
        "summary": "Build muscle with knee-friendly lower body work.",
        "progression": "Add reps before load.",
        "days": [
            {
                "heading": "Day 1: Upper Body",
                "warmup": "Easy bike and shoulder circles.",
                "exercises": [
                    {
                        "name": "Incline Dumbbell Press",
                        "prescription": "3 sets x 10 reps",
                        "notes": "Leave 1-2 reps in reserve.",
                        "sets": 3,
                        "activeSeconds": 45,
                        "restBetweenSetsSeconds": 90,
                        "restBetweenExercisesSeconds": 120,
                    }
                ],
                "finisher": "Farmer carry",
                "recovery": "Walk and breathe.",
            }
        ],
    }


def test_answer_workout_session_chat_builds_compact_context() -> None:
    client = StaticChatClient()
    response = answer_workout_session_chat(
        WorkoutSessionChatRequest(
            workspace="wk_jordan",
            day_heading="Day 1: Upper Body",
            question="What muscles does incline press target?",
            history=(
                WorkoutSessionChatTurn(
                    question="How heavy?",
                    arnold_response="Moderate.",
                ),
            ),
        ),
        profile=_profile(),
        rendered_plan=_rendered_plan(),
        client=client,
    )

    assert response == WorkoutSessionChatResponse(
        arnold_response="Keep the reps clean and controlled.",
    )
    call = client.calls[0]
    assert call["schema"] == CHAT_RESPONSE_SCHEMA
    assert call["schema_name"] == "workout_session_chat"
    user_prompt = str(call["user_prompt"])
    context = json.loads(user_prompt.split("Context JSON:", maxsplit=1)[1])
    assert context["athlete_profile"]["limitations"] == ["Left knee irritation"]
    assert context["workout_day"]["heading"] == "Day 1: Upper Body"
    assert context["workout_day"]["exercises"][0]["name"] == "Incline Dumbbell Press"
    assert context["history"][0]["question"] == "How heavy?"


def test_find_workout_day_rejects_unknown_heading() -> None:
    with pytest.raises(WorkoutSessionChatError, match="was not found"):
        find_workout_day(_rendered_plan(), "Day 2")


def test_answer_workout_session_chat_rejects_blank_question() -> None:
    with pytest.raises(WorkoutSessionChatError, match="Question is required"):
        answer_workout_session_chat(
            WorkoutSessionChatRequest(
                workspace="wk_jordan",
                day_heading="Day 1: Upper Body",
                question=" ",
            ),
            profile=_profile(),
            rendered_plan=_rendered_plan(),
            client=StaticChatClient(),
        )


def test_answer_workout_session_chat_wraps_llm_errors() -> None:
    with pytest.raises(WorkoutSessionChatError, match="LLM request failed"):
        answer_workout_session_chat(
            WorkoutSessionChatRequest(
                workspace="wk_jordan",
                day_heading="Day 1: Upper Body",
                question="What should I feel?",
            ),
            profile=_profile(),
            rendered_plan=_rendered_plan(),
            client=StaticChatClient(error=LlmError("LLM request failed")),
        )
