from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from typing import Any, Protocol

from personal_trainer.models import UserProfile
from personal_trainer.llm_client import LlmError
from personal_trainer.prompting import PromptManager, PromptManagerError

LOGGER = logging.getLogger(__name__)

SYSTEM_PROMPT_TEMPLATE = "trainer/workout_session_chat_system_prompt.jinja"
USER_PROMPT_TEMPLATE = "trainer/workout_session_chat_user_prompt.jinja"
MAX_HISTORY_TURNS = 4
MAX_QUESTION_CHARS = 800
MAX_RESPONSE_CHARS = 1200


class WorkoutSessionChatError(RuntimeError):
    """Raised when Workout Session chat cannot be completed."""


class WorkoutSessionChatClient(Protocol):
    def chat_json(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        schema: dict[str, Any],
        schema_name: str = "trainer_weekly_plan",
    ) -> dict[str, Any]:
        ...


@dataclass(frozen=True, slots=True)
class WorkoutSessionChatTurn:
    question: str
    arnold_response: str


@dataclass(frozen=True, slots=True)
class WorkoutSessionChatRequest:
    workspace: str
    day_heading: str
    question: str
    history: tuple[WorkoutSessionChatTurn, ...] = ()


@dataclass(frozen=True, slots=True)
class WorkoutSessionChatResponse:
    arnold_response: str


CHAT_RESPONSE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": ["arnold_response"],
    "properties": {
        "arnold_response": {
            "type": "string",
            "minLength": 1,
            "maxLength": MAX_RESPONSE_CHARS,
        },
    },
}


def answer_workout_session_chat(
    request: WorkoutSessionChatRequest,
    *,
    profile: UserProfile,
    rendered_plan: dict[str, Any],
    client: WorkoutSessionChatClient,
    prompt_manager: PromptManager | None = None,
) -> WorkoutSessionChatResponse:
    question = _clean_text(request.question)
    if not question:
        raise WorkoutSessionChatError("Question is required.")
    if len(question) > MAX_QUESTION_CHARS:
        raise WorkoutSessionChatError(
            f"Question must be {MAX_QUESTION_CHARS} characters or fewer."
        )

    day = find_workout_day(rendered_plan, request.day_heading)
    context = {
        "workspace": request.workspace,
        "athlete_profile": _compact_profile(profile),
        "workout_plan": {
            "title": _clean_text(rendered_plan.get("title")),
            "summary": _clean_text(rendered_plan.get("summary")),
            "progression": _clean_text(rendered_plan.get("progression")),
        },
        "workout_day": _compact_day(day),
        "history": [_compact_turn(turn) for turn in request.history[-MAX_HISTORY_TURNS:]],
        "question": question,
    }

    manager = prompt_manager or PromptManager()
    try:
        system_prompt = manager.render(SYSTEM_PROMPT_TEMPLATE)
        user_prompt = manager.render(
            USER_PROMPT_TEMPLATE,
            context_json=json.dumps(context, ensure_ascii=False, indent=2),
        )
    except PromptManagerError as error:
        raise WorkoutSessionChatError(
            f"Unable to render Workout Session chat prompt: {error}"
        ) from error

    LOGGER.info(
        "Requesting Workout Session chat answer",
        extra={"workspace": request.workspace, "day_heading": request.day_heading},
    )
    try:
        payload = client.chat_json(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            schema=CHAT_RESPONSE_SCHEMA,
            schema_name="workout_session_chat",
        )
    except LlmError as error:
        raise WorkoutSessionChatError(str(error)) from error

    return _parse_response(payload)


def find_workout_day(rendered_plan: dict[str, Any], day_heading: str) -> dict[str, Any]:
    heading = _clean_text(day_heading)
    if not heading:
        raise WorkoutSessionChatError("Workout Day heading is required.")
    days = rendered_plan.get("days")
    if not isinstance(days, list):
        raise WorkoutSessionChatError("Current Workout Plan does not include days.")
    for day in days:
        if not isinstance(day, dict):
            continue
        if _clean_text(day.get("heading")) == heading:
            return day
    raise WorkoutSessionChatError(f"Workout Day '{heading}' was not found.")


def _parse_response(payload: dict[str, Any]) -> WorkoutSessionChatResponse:
    arnold = _clean_text(payload.get("arnold_response"))
    if not arnold:
        raise WorkoutSessionChatError("Chat response was missing Arnold's answer.")
    return WorkoutSessionChatResponse(
        arnold_response=arnold,
    )


def _compact_profile(profile: UserProfile) -> dict[str, Any]:
    return {
        "name": profile.name,
        "goal": profile.goal,
        "experience_level": profile.experience_level,
        "training_days": profile.training_days,
        "session_length_minutes": profile.session_length_minutes,
        "equipment": profile.equipment,
        "limitations": profile.limitations,
        "preferred_focus": profile.preferred_focus,
        "cardio_preference": profile.cardio_preference,
    }


def _compact_day(day: dict[str, Any]) -> dict[str, Any]:
    exercises = day.get("exercises")
    return {
        "heading": _clean_text(day.get("heading")),
        "warmup": _clean_text(day.get("warmup")),
        "exercises": [
            {
                "name": _clean_text(exercise.get("name")),
                "prescription": _clean_text(exercise.get("prescription")),
                "notes": _clean_text(exercise.get("notes")),
                "sets": exercise.get("sets"),
                "active_seconds": exercise.get("activeSeconds"),
                "rest_between_sets_seconds": exercise.get("restBetweenSetsSeconds"),
                "rest_between_exercises_seconds": exercise.get(
                    "restBetweenExercisesSeconds"
                ),
            }
            for exercise in exercises
            if isinstance(exercise, dict)
        ]
        if isinstance(exercises, list)
        else [],
        "finisher": _clean_text(day.get("finisher")),
        "recovery": _clean_text(day.get("recovery")),
    }


def _compact_turn(turn: WorkoutSessionChatTurn) -> dict[str, str]:
    return {
        "question": _truncate(_clean_text(turn.question), MAX_QUESTION_CHARS),
        "arnold_response": _truncate(
            _clean_text(turn.arnold_response), MAX_RESPONSE_CHARS
        ),
    }


def _clean_text(value: Any) -> str:
    if not isinstance(value, str):
        return ""
    return " ".join(value.strip().split())


def _truncate(value: str, max_chars: int) -> str:
    return value if len(value) <= max_chars else value[: max_chars - 1].rstrip() + "…"
