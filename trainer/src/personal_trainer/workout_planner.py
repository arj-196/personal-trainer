from __future__ import annotations

import json
import logging
from dataclasses import asdict, dataclass
from datetime import date
from typing import Any, Protocol

from personal_trainer.exercise_library import all_references
from personal_trainer.models import (
    CheckIn,
    Exercise,
    UserProfile,
    WorkoutDay,
    WorkoutPlan,
)
from personal_trainer.ollama_client import (
    OllamaChatClient,
    OllamaClientConfig,
    OllamaError,
)
from personal_trainer.openai_client import (
    OpenAIChatClient,
    OpenAIClientConfig,
    OpenAIError,
)

LOGGER = logging.getLogger(__name__)

PLAN_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": [
        "summary",
        "progression_note",
        "next_checkin_prompt",
        "coach_notes_focus",
        "coach_notes_cautions",
        "days",
    ],
    "properties": {
        "summary": {"type": "string"},
        "progression_note": {"type": "string"},
        "next_checkin_prompt": {"type": "string"},
        "coach_notes_focus": {
            "type": "array",
            "items": {"type": "string"},
        },
        "coach_notes_cautions": {
            "type": "array",
            "items": {"type": "string"},
        },
        "days": {
            "type": "array",
            "minItems": 1,
            "maxItems": 7,
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": [
                    "day_label",
                    "focus",
                    "warmup",
                    "exercises",
                    "finisher",
                    "recovery",
                ],
                "properties": {
                    "day_label": {"type": "string"},
                    "focus": {"type": "string"},
                    "warmup": {"type": "string"},
                    "finisher": {"type": "string"},
                    "recovery": {"type": "string"},
                    "exercises": {
                        "type": "array",
                        "minItems": 1,
                        "items": {
                            "type": "object",
                            "additionalProperties": False,
                            "required": ["name", "prescription", "notes"],
                            "properties": {
                                "name": {"type": "string"},
                                "prescription": {"type": "string"},
                                "notes": {"type": "string"},
                            },
                        },
                    },
                },
            },
        },
    },
}


class WorkoutPlannerError(RuntimeError):
    """Raised when an LLM-generated plan cannot be requested or normalized."""


@dataclass(frozen=True, slots=True)
class TrainerPlanRequest:
    profile: UserProfile
    plan_version: int
    checkin: CheckIn | None = None


@dataclass(frozen=True, slots=True)
class TrainerPlanDraft:
    payload: dict[str, Any]
    provider: str
    model_name: str


class TrainerAgent(Protocol):
    model_name: str

    def generate_weekly_plan(self, request: TrainerPlanRequest) -> TrainerPlanDraft:
        """Return a structured weekly plan for the athlete."""


class OllamaTrainerAgent:
    SYSTEM_PROMPT = """You are an elite personal trainer and strength coach.

Build the best possible training plan for the next week from the athlete profile and optional weekly check-in.
Act like a real coach: adapt to goals, recovery, equipment, experience, limitations, and preferences.
Do not mention being an AI model. Do not ask follow-up questions. Make reasonable assumptions and keep the plan practical.
Return only JSON that matches the provided schema.
"""

    def __init__(self, client: OllamaChatClient) -> None:
        self._client = client
        self.model_name = client.config.model

    def generate_weekly_plan(self, request: TrainerPlanRequest) -> TrainerPlanDraft:
        LOGGER.info(
            "Building trainer prompt for %s (%s days, %s minute sessions)",
            request.profile.name,
            request.profile.training_days,
            request.profile.session_length_minutes,
        )
        payload = self._client.chat_json(
            system_prompt=self.SYSTEM_PROMPT,
            user_prompt=_build_user_prompt(request),
            schema=PLAN_SCHEMA,
        )
        LOGGER.info("Received structured planner response from model '%s'", self.model_name)
        return TrainerPlanDraft(
            payload=payload,
            provider="ollama",
            model_name=self.model_name,
        )


class OpenAITrainerAgent:
    SYSTEM_PROMPT = OllamaTrainerAgent.SYSTEM_PROMPT

    def __init__(self, client: OpenAIChatClient) -> None:
        self._client = client
        self.model_name = client.config.model

    def generate_weekly_plan(self, request: TrainerPlanRequest) -> TrainerPlanDraft:
        LOGGER.info(
            "Building trainer prompt for %s (%s days, %s minute sessions)",
            request.profile.name,
            request.profile.training_days,
            request.profile.session_length_minutes,
        )
        payload = self._client.chat_json(
            system_prompt=self.SYSTEM_PROMPT,
            user_prompt=_build_user_prompt(request),
            schema=PLAN_SCHEMA,
        )
        LOGGER.info("Received structured planner response from model '%s'", self.model_name)
        return TrainerPlanDraft(
            payload=payload,
            provider="openai",
            model_name=self.model_name,
        )


def build_plan(
    profile: UserProfile,
    plan_version: int,
    checkin: CheckIn | None = None,
    *,
    agent: TrainerAgent | None = None,
    client_config: OllamaClientConfig | None = None,
    openai_client_config: OpenAIClientConfig | None = None,
) -> WorkoutPlan:
    planner: TrainerAgent
    if agent is not None:
        planner = agent
    elif openai_client_config is not None:
        planner = OpenAITrainerAgent(OpenAIChatClient(openai_client_config))
    else:
        planner = OllamaTrainerAgent(OllamaChatClient(client_config or OllamaClientConfig()))
    LOGGER.info("Preparing structured request for plan version %s", plan_version)
    request = TrainerPlanRequest(
        profile=profile,
        plan_version=plan_version,
        checkin=checkin,
    )

    try:
        draft = planner.generate_weekly_plan(request)
    except (OllamaError, OpenAIError) as error:
        raise WorkoutPlannerError(
            f"Unable to generate a plan with model '{planner.model_name}': {error}"
        ) from error

    return _normalize_plan(
        draft,
        generated_on=date.today(),
        plan_version=plan_version,
    )


def _build_user_prompt(request: TrainerPlanRequest) -> str:
    references = [
        {
            "name": reference.name,
            "aliases": list(reference.aliases),
            "summary": reference.summary,
            "setup": reference.setup,
            "cues": list(reference.cues),
        }
        for reference in all_references()
    ]
    LOGGER.info("Loaded %s exercise references into the trainer prompt", len(references))
    payload = {
        "today": date.today().isoformat(),
        "target_plan_version": request.plan_version,
        "athlete_profile": asdict(request.profile),
        "latest_checkin": asdict(request.checkin) if request.checkin else None,
        "exercise_library": references,
    }
    return f"""Create the athlete's best customized workout plan for the next week.

Use the profile and latest check-in to choose the split, exercise selection, volume, intensity, and recovery emphasis. There are no hardcoded split rules outside your judgment.

Important requirements:
- Keep `day_label` in the form `Day 1`, `Day 2`, and so on.
- Prefer exercise names from the provided exercise library when they fit, because the app links those names to reference cards.
- You may use an exercise not in the library when it is clearly better for the athlete.
- Match the athlete's available training days and session length unless the recovery picture strongly justifies fewer sessions.
- Keep `summary`, `progression_note`, `warmup`, `finisher`, `recovery`, and `next_checkin_prompt` concise and practical.
- Each exercise needs a compact `prescription` string, for example `4 sets x 6-8 reps @ RPE 7`.
- `coach_notes_focus` should contain the main coaching priorities for the week.
- `coach_notes_cautions` should call out pain, recovery, or execution risks only when relevant.

Planning context JSON:
{json.dumps(payload, indent=2, default=str)}
"""


def _normalize_plan(
    draft: TrainerPlanDraft,
    *,
    generated_on: date,
    plan_version: int,
) -> WorkoutPlan:
    payload = draft.payload
    if not isinstance(payload, dict):
        raise WorkoutPlannerError("Structured planner output must be a JSON object")

    raw_days = payload.get("days")
    if not isinstance(raw_days, list) or not raw_days:
        raise WorkoutPlannerError(
            "Structured planner output must include at least one training day"
        )

    days: list[WorkoutDay] = []
    for index, raw_day in enumerate(raw_days, start=1):
        days.append(_normalize_day(raw_day, index=index))

    summary = _require_text(payload, "summary")
    progression_note = _require_text(payload, "progression_note")
    next_checkin_prompt = _require_text(payload, "next_checkin_prompt")
    LOGGER.info("Validated structured plan with %s training days", len(days))

    return WorkoutPlan(
        generated_on=generated_on,
        plan_version=plan_version,
        summary=summary,
        progression_note=progression_note,
        days=days,
        next_checkin_prompt=next_checkin_prompt,
        planner_backend=f"{draft.provider}/{draft.model_name}",
        coach_notes_focus=_optional_text_list(payload.get("coach_notes_focus")),
        coach_notes_cautions=_optional_text_list(payload.get("coach_notes_cautions")),
    )


def _normalize_day(value: Any, *, index: int) -> WorkoutDay:
    if not isinstance(value, dict):
        raise WorkoutPlannerError(f"Day {index} must be a JSON object")

    raw_exercises = value.get("exercises")
    if not isinstance(raw_exercises, list) or not raw_exercises:
        raise WorkoutPlannerError(f"Day {index} must include at least one exercise")

    exercises = [_normalize_exercise(item, day_index=index) for item in raw_exercises]
    day_label = _clean_text(value.get("day_label")) or f"Day {index}"
    if not day_label.lower().startswith("day "):
        day_label = f"Day {index}"

    return WorkoutDay(
        day_label=day_label,
        focus=_require_text(value, "focus", scope=f"day {index}"),
        warmup=_require_text(value, "warmup", scope=f"day {index}"),
        exercises=exercises,
        finisher=_require_text(value, "finisher", scope=f"day {index}"),
        recovery=_require_text(value, "recovery", scope=f"day {index}"),
    )


def _normalize_exercise(value: Any, *, day_index: int) -> Exercise:
    if not isinstance(value, dict):
        raise WorkoutPlannerError(
            f"Day {day_index} includes an invalid exercise entry"
        )

    return Exercise(
        name=_require_text(value, "name", scope=f"day {day_index} exercise"),
        prescription=_require_text(
            value,
            "prescription",
            scope=f"day {day_index} exercise",
        ),
        notes=_require_text(value, "notes", scope=f"day {day_index} exercise"),
    )


def _require_text(
    value: dict[str, Any],
    key: str,
    *,
    scope: str = "plan",
) -> str:
    cleaned = _clean_text(value.get(key))
    if cleaned:
        return cleaned
    raise WorkoutPlannerError(f"The {scope} is missing a usable '{key}' field")


def _optional_text_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    cleaned_values = [_clean_text(item) for item in value]
    return [item for item in cleaned_values if item]


def _clean_text(value: Any) -> str:
    if not isinstance(value, str):
        return ""
    return " ".join(value.strip().split())
