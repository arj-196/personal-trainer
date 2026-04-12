from __future__ import annotations

import json
import logging
from dataclasses import asdict, dataclass
from datetime import date
from pathlib import Path
from typing import Any, Protocol

from personal_trainer.exercise_library import all_references
from personal_trainer.llm import LLMRunner, start_workflow
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
from personal_trainer.prompting import PromptManager, PromptManagerError

LOGGER = logging.getLogger(__name__)
PROMPT_MANAGER = PromptManager()
WEEKLY_PLAN_TEMPLATE = "trainer/weekly_plan.jinja"
PLAN_REVIEW_TEMPLATE = "trainer/plan_review.jinja"
PLAN_REVISION_TEMPLATE = "trainer/plan_revision.jinja"
SYSTEM_PROMPT_TEMPLATE = "trainer/weekly_plan_system_prompt.jinja"
ARNOLD_REVIEWER_SYSTEM_PROMPT_TEMPLATE = "trainer/reviewer_arnold_system_prompt.jinja"
DOCTOR_MIKE_REVIEWER_SYSTEM_PROMPT_TEMPLATE = (
    "trainer/reviewer_doctor_mike_system_prompt.jinja"
)

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
                    "warmup_active_seconds",
                    "exercises",
                    "finisher",
                    "finisher_active_seconds",
                    "recovery",
                    "recovery_active_seconds",
                ],
                "properties": {
                    "day_label": {"type": "string"},
                    "focus": {"type": "string"},
                    "warmup": {"type": "string"},
                    "warmup_active_seconds": {"type": "integer", "minimum": 1},
                    "finisher": {"type": "string"},
                    "finisher_active_seconds": {"type": "integer", "minimum": 1},
                    "recovery": {"type": "string"},
                    "recovery_active_seconds": {"type": "integer", "minimum": 1},
                    "exercises": {
                        "type": "array",
                        "minItems": 1,
                        "items": {
                            "type": "object",
                            "additionalProperties": False,
                            "required": [
                                "name",
                                "prescription",
                                "notes",
                                "sets",
                                "active_seconds",
                                "rest_between_sets_seconds",
                                "rest_between_exercises_seconds",
                            ],
                            "properties": {
                                "name": {"type": "string"},
                                "prescription": {"type": "string"},
                                "notes": {"type": "string"},
                                "sets": {"type": "integer", "minimum": 1},
                                "active_seconds": {"type": "integer", "minimum": 1},
                                "rest_between_sets_seconds": {
                                    "type": "integer",
                                    "minimum": 1,
                                },
                                "rest_between_exercises_seconds": {
                                    "type": "integer",
                                    "minimum": 1,
                                },
                            },
                        },
                    },
                },
            },
        },
    },
}

REVIEW_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": [
        "approved",
        "blocking_issues",
        "suggested_changes",
        "reasoning_summary",
    ],
    "properties": {
        "approved": {"type": "boolean"},
        "blocking_issues": {
            "type": "array",
            "items": {"type": "string"},
        },
        "suggested_changes": {
            "type": "array",
            "items": {"type": "string"},
        },
        "reasoning_summary": {"type": "string"},
    },
}

ARNOLD_PERSONA = "Arnold Schwarzenegger"
DOCTOR_MIKE_PERSONA = "Doctor Mike"


class WorkoutPlannerError(RuntimeError):
    """Raised when an LLM-generated plan cannot be requested or normalized."""


@dataclass(frozen=True, slots=True)
class TrainerPlanRequest:
    profile: UserProfile
    plan_version: int
    checkin: CheckIn | None = None
    trace_id: str | None = None
    session_id: str | None = None
    workflow_name: str = "weekly_plan_generation"
    llm_log_path: Path | None = None


@dataclass(frozen=True, slots=True)
class TrainerPlanDraft:
    payload: dict[str, Any]
    provider: str
    model_name: str


@dataclass(frozen=True, slots=True)
class ReviewerFeedback:
    persona: str
    approved: bool
    blocking_issues: list[str]
    suggested_changes: list[str]
    reasoning_summary: str


@dataclass(frozen=True, slots=True)
class PlanReviewIteration:
    iteration: int
    planner_step_name: str
    plan_payload: dict[str, Any]
    arnold_review: ReviewerFeedback
    doctor_mike_review: ReviewerFeedback
    approved: bool


@dataclass(frozen=True, slots=True)
class WorkoutPlanBuildResult:
    plan: WorkoutPlan
    review_report: dict[str, Any]
    reached_max_iterations: bool


class TrainerAgent(Protocol):
    model_name: str

    def run_json_step(
        self,
        request: TrainerPlanRequest,
        *,
        system_prompt: str,
        user_prompt: str,
        schema: dict[str, Any],
        step_name: str,
        metadata: dict[str, Any],
    ) -> TrainerPlanDraft:
        """Run one structured JSON step for the planner workflow."""


class OllamaTrainerAgent:
    def __init__(self, client: OllamaChatClient) -> None:
        self._client = client
        self.model_name = client.config.model

    def run_json_step(
        self,
        request: TrainerPlanRequest,
        *,
        system_prompt: str,
        user_prompt: str,
        schema: dict[str, Any],
        step_name: str,
        metadata: dict[str, Any],
    ) -> TrainerPlanDraft:
        LOGGER.info(
            "Running step '%s' for %s (%s days, %s minute sessions)",
            step_name,
            request.profile.name,
            request.profile.training_days,
            request.profile.session_length_minutes,
        )
        runner = LLMRunner(jsonl_path=request.llm_log_path)
        result = runner.run_step(
            trace_id=request.trace_id,
            session_id=request.session_id,
            workflow_name=request.workflow_name,
            step_name=step_name,
            model=self.model_name,
            prompt=user_prompt,
            metadata={
                "provider": "ollama",
                "target_plan_version": request.plan_version,
                "athlete_name": request.profile.name,
                **metadata,
            },
            execute=lambda: self._client.chat_json(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                schema=schema,
            ),
        )
        payload = result.output
        if not isinstance(payload, dict):
            raise WorkoutPlannerError(
                "Structured planner output must be a JSON object"
            )
        LOGGER.info(
            "Received structured planner response from model '%s'", self.model_name
        )
        return TrainerPlanDraft(
            payload=payload,
            provider="ollama",
            model_name=self.model_name,
        )

    def generate_weekly_plan(self, request: TrainerPlanRequest) -> TrainerPlanDraft:
        return self.run_json_step(
            request,
            system_prompt=_build_system_prompt(),
            user_prompt=_build_user_prompt(request),
            schema=PLAN_SCHEMA,
            step_name="planner_initial",
            metadata={},
        )


class OpenAITrainerAgent:
    def __init__(self, client: OpenAIChatClient) -> None:
        self._client = client
        self.model_name = client.config.model

    def run_json_step(
        self,
        request: TrainerPlanRequest,
        *,
        system_prompt: str,
        user_prompt: str,
        schema: dict[str, Any],
        step_name: str,
        metadata: dict[str, Any],
    ) -> TrainerPlanDraft:
        LOGGER.info(
            "Running step '%s' for %s (%s days, %s minute sessions)",
            step_name,
            request.profile.name,
            request.profile.training_days,
            request.profile.session_length_minutes,
        )
        runner = LLMRunner(jsonl_path=request.llm_log_path)
        result = runner.run_step(
            trace_id=request.trace_id,
            session_id=request.session_id,
            workflow_name=request.workflow_name,
            step_name=step_name,
            model=self.model_name,
            prompt=user_prompt,
            metadata={
                "provider": "openai",
                "target_plan_version": request.plan_version,
                "athlete_name": request.profile.name,
                **metadata,
            },
            execute=lambda: self._client.chat_json(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                schema=schema,
            ),
        )
        payload = result.output
        if not isinstance(payload, dict):
            raise WorkoutPlannerError(
                "Structured planner output must be a JSON object"
            )
        LOGGER.info(
            "Received structured planner response from model '%s'", self.model_name
        )
        return TrainerPlanDraft(
            payload=payload,
            provider="openai",
            model_name=self.model_name,
        )

    def generate_weekly_plan(self, request: TrainerPlanRequest) -> TrainerPlanDraft:
        return self.run_json_step(
            request,
            system_prompt=_build_system_prompt(),
            user_prompt=_build_user_prompt(request),
            schema=PLAN_SCHEMA,
            step_name="planner_initial",
            metadata={},
        )


def build_plan(
    profile: UserProfile,
    plan_version: int,
    checkin: CheckIn | None = None,
    *,
    agent: TrainerAgent | None = None,
    client_config: OllamaClientConfig | None = None,
    openai_client_config: OpenAIClientConfig | None = None,
    workflow_name: str = "weekly_plan_generation",
    trace_id: str | None = None,
    session_id: str | None = None,
    llm_log_path: Path | None = None,
    max_review_iterations: int = 5,
) -> WorkoutPlan:
    result = build_plan_with_review(
        profile=profile,
        plan_version=plan_version,
        checkin=checkin,
        agent=agent,
        client_config=client_config,
        openai_client_config=openai_client_config,
        workflow_name=workflow_name,
        trace_id=trace_id,
        session_id=session_id,
        llm_log_path=llm_log_path,
        max_review_iterations=max_review_iterations,
    )
    return result.plan


def build_plan_with_review(
    profile: UserProfile,
    plan_version: int,
    checkin: CheckIn | None = None,
    *,
    agent: TrainerAgent | None = None,
    client_config: OllamaClientConfig | None = None,
    openai_client_config: OpenAIClientConfig | None = None,
    workflow_name: str = "weekly_plan_generation",
    trace_id: str | None = None,
    session_id: str | None = None,
    llm_log_path: Path | None = None,
    max_review_iterations: int = 5,
) -> WorkoutPlanBuildResult:
    if max_review_iterations <= 0:
        raise WorkoutPlannerError("max_review_iterations must be greater than zero")

    planner: TrainerAgent
    if agent is not None:
        planner = agent
    elif openai_client_config is not None:
        planner = OpenAITrainerAgent(OpenAIChatClient(openai_client_config))
    else:
        planner = OllamaTrainerAgent(
            OllamaChatClient(client_config or OllamaClientConfig())
        )
    LOGGER.info("Preparing structured request for plan version %s", plan_version)
    request = TrainerPlanRequest(
        profile=profile,
        plan_version=plan_version,
        checkin=checkin,
        trace_id=trace_id or start_workflow(workflow_name),
        session_id=session_id,
        workflow_name=workflow_name,
        llm_log_path=llm_log_path,
    )

    planner_system_prompt = _build_system_prompt()
    arnold_system_prompt = _build_arnold_reviewer_system_prompt()
    doctor_mike_system_prompt = _build_doctor_mike_reviewer_system_prompt()
    try:
        current_plan_draft = planner.run_json_step(
            request,
            system_prompt=planner_system_prompt,
            user_prompt=_build_user_prompt(request),
            schema=PLAN_SCHEMA,
            step_name="planner_initial",
            metadata={"phase": "initial"},
        )
    except WorkoutPlannerError:
        raise
    except (OllamaError, OpenAIError) as error:
        raise WorkoutPlannerError(
            f"Unable to generate a plan with model '{planner.model_name}': {error}"
        ) from error

    review_iterations: list[PlanReviewIteration] = []
    final_status = "approved"
    unresolved_personas: list[str] = []

    for iteration in range(1, max_review_iterations + 1):
        arnold_review_draft = _run_reviewer_step(
            planner=planner,
            request=request,
            system_prompt=arnold_system_prompt,
            user_prompt=_build_plan_review_prompt(
                request,
                plan_payload=current_plan_draft.payload,
                persona=ARNOLD_PERSONA,
                iteration=iteration,
            ),
            step_name=f"review_arnold_iter_{iteration}",
            persona=ARNOLD_PERSONA,
            iteration=iteration,
        )
        doctor_mike_review_draft = _run_reviewer_step(
            planner=planner,
            request=request,
            system_prompt=doctor_mike_system_prompt,
            user_prompt=_build_plan_review_prompt(
                request,
                plan_payload=current_plan_draft.payload,
                persona=DOCTOR_MIKE_PERSONA,
                iteration=iteration,
            ),
            step_name=f"review_doctor_mike_iter_{iteration}",
            persona=DOCTOR_MIKE_PERSONA,
            iteration=iteration,
        )

        arnold_review = _normalize_reviewer_feedback(
            arnold_review_draft.payload,
            persona=ARNOLD_PERSONA,
        )
        doctor_mike_review = _normalize_reviewer_feedback(
            doctor_mike_review_draft.payload,
            persona=DOCTOR_MIKE_PERSONA,
        )
        approved = arnold_review.approved and doctor_mike_review.approved
        review_iterations.append(
            PlanReviewIteration(
                iteration=iteration,
                planner_step_name=(
                    "planner_initial" if iteration == 1 else f"planner_revision_iter_{iteration - 1}"
                ),
                plan_payload=current_plan_draft.payload,
                arnold_review=arnold_review,
                doctor_mike_review=doctor_mike_review,
                approved=approved,
            )
        )

        if approved:
            break

        if iteration == max_review_iterations:
            final_status = "max_iterations_reached"
            unresolved_personas = [
                feedback.persona
                for feedback in (arnold_review, doctor_mike_review)
                if not feedback.approved
            ]
            break

        current_plan_draft = _run_plan_revision_step(
            planner=planner,
            request=request,
            system_prompt=planner_system_prompt,
            user_prompt=_build_plan_revision_prompt(
                request,
                iteration=iteration,
                current_plan_payload=current_plan_draft.payload,
                arnold_feedback=arnold_review,
                doctor_mike_feedback=doctor_mike_review,
            ),
            step_name=f"planner_revision_iter_{iteration}",
            iteration=iteration,
        )

    plan = _normalize_plan(
        current_plan_draft,
        generated_on=date.today(),
        plan_version=plan_version,
    )
    report = _build_review_report(
        request=request,
        draft=current_plan_draft,
        iterations=review_iterations,
        max_review_iterations=max_review_iterations,
        final_status=final_status,
        unresolved_personas=unresolved_personas,
    )
    reached_max_iterations = final_status == "max_iterations_reached"
    if reached_max_iterations:
        LOGGER.warning(
            "Plan generation reached max review iterations (%s). Unresolved personas: %s",
            max_review_iterations,
            ", ".join(unresolved_personas) if unresolved_personas else "none",
        )
    else:
        LOGGER.info(
            "Plan approved by both personas after %s review iteration(s)",
            len(review_iterations),
        )
    return WorkoutPlanBuildResult(
        plan=plan,
        review_report=report,
        reached_max_iterations=reached_max_iterations,
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
    LOGGER.info(
        "Loaded %s exercise references into the trainer prompt", len(references)
    )
    payload = {
        "today": date.today().isoformat(),
        "target_plan_version": request.plan_version,
        "athlete_profile": asdict(request.profile),
        "latest_checkin": asdict(request.checkin) if request.checkin else None,
        "exercise_library": references,
    }
    payload_json = json.dumps(payload, indent=2, default=str)
    try:
        return PROMPT_MANAGER.render(
            WEEKLY_PLAN_TEMPLATE,
            payload_json=payload_json,
        )
    except PromptManagerError as error:
        raise WorkoutPlannerError(
            f"Unable to render workout planner prompt: {error}"
        ) from error


def _build_plan_review_prompt(
    request: TrainerPlanRequest,
    *,
    plan_payload: dict[str, Any],
    persona: str,
    iteration: int,
) -> str:
    payload = {
        "today": date.today().isoformat(),
        "iteration": iteration,
        "persona": persona,
        "target_plan_version": request.plan_version,
        "athlete_profile": asdict(request.profile),
        "latest_checkin": asdict(request.checkin) if request.checkin else None,
        "candidate_plan": plan_payload,
    }
    payload_json = json.dumps(payload, indent=2, default=str)
    try:
        return PROMPT_MANAGER.render(
            PLAN_REVIEW_TEMPLATE,
            payload_json=payload_json,
        )
    except PromptManagerError as error:
        raise WorkoutPlannerError(
            f"Unable to render workout plan review prompt: {error}"
        ) from error


def _build_plan_revision_prompt(
    request: TrainerPlanRequest,
    *,
    iteration: int,
    current_plan_payload: dict[str, Any],
    arnold_feedback: ReviewerFeedback,
    doctor_mike_feedback: ReviewerFeedback,
) -> str:
    payload = {
        "today": date.today().isoformat(),
        "iteration": iteration,
        "target_plan_version": request.plan_version,
        "athlete_profile": asdict(request.profile),
        "latest_checkin": asdict(request.checkin) if request.checkin else None,
        "current_plan": current_plan_payload,
        "review_feedback": [
            asdict(arnold_feedback),
            asdict(doctor_mike_feedback),
        ],
    }
    payload_json = json.dumps(payload, indent=2, default=str)
    try:
        return PROMPT_MANAGER.render(
            PLAN_REVISION_TEMPLATE,
            payload_json=payload_json,
        )
    except PromptManagerError as error:
        raise WorkoutPlannerError(
            f"Unable to render workout plan revision prompt: {error}"
        ) from error


def _build_system_prompt() -> str:
    try:
        return PROMPT_MANAGER.render(SYSTEM_PROMPT_TEMPLATE)
    except PromptManagerError as error:
        raise WorkoutPlannerError(
            f"Unable to render workout planner system prompt: {error}"
        ) from error


def _build_arnold_reviewer_system_prompt() -> str:
    try:
        return PROMPT_MANAGER.render(ARNOLD_REVIEWER_SYSTEM_PROMPT_TEMPLATE)
    except PromptManagerError as error:
        raise WorkoutPlannerError(
            f"Unable to render Arnold reviewer system prompt: {error}"
        ) from error


def _build_doctor_mike_reviewer_system_prompt() -> str:
    try:
        return PROMPT_MANAGER.render(DOCTOR_MIKE_REVIEWER_SYSTEM_PROMPT_TEMPLATE)
    except PromptManagerError as error:
        raise WorkoutPlannerError(
            f"Unable to render Doctor Mike reviewer system prompt: {error}"
        ) from error


def _run_reviewer_step(
    *,
    planner: TrainerAgent,
    request: TrainerPlanRequest,
    system_prompt: str,
    user_prompt: str,
    step_name: str,
    persona: str,
    iteration: int,
) -> TrainerPlanDraft:
    try:
        return planner.run_json_step(
            request,
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            schema=REVIEW_SCHEMA,
            step_name=step_name,
            metadata={
                "phase": "review",
                "iteration": iteration,
                "persona": persona,
            },
        )
    except WorkoutPlannerError:
        raise
    except (OllamaError, OpenAIError) as error:
        raise WorkoutPlannerError(
            f"Unable to run review step '{step_name}' with model '{planner.model_name}': {error}"
        ) from error


def _run_plan_revision_step(
    *,
    planner: TrainerAgent,
    request: TrainerPlanRequest,
    system_prompt: str,
    user_prompt: str,
    step_name: str,
    iteration: int,
) -> TrainerPlanDraft:
    try:
        return planner.run_json_step(
            request,
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            schema=PLAN_SCHEMA,
            step_name=step_name,
            metadata={
                "phase": "revision",
                "iteration": iteration,
            },
        )
    except WorkoutPlannerError:
        raise
    except (OllamaError, OpenAIError) as error:
        raise WorkoutPlannerError(
            f"Unable to run revision step '{step_name}' with model '{planner.model_name}': {error}"
        ) from error


def _normalize_reviewer_feedback(
    payload: dict[str, Any],
    *,
    persona: str,
) -> ReviewerFeedback:
    if not isinstance(payload, dict):
        raise WorkoutPlannerError(
            f"Reviewer output for {persona} must be a JSON object"
        )
    approved = payload.get("approved")
    if not isinstance(approved, bool):
        raise WorkoutPlannerError(
            f"Reviewer output for {persona} must include boolean 'approved'"
        )
    reasoning_summary = _require_text(payload, "reasoning_summary", scope=persona)
    return ReviewerFeedback(
        persona=persona,
        approved=approved,
        blocking_issues=_optional_text_list(payload.get("blocking_issues")),
        suggested_changes=_optional_text_list(payload.get("suggested_changes")),
        reasoning_summary=reasoning_summary,
    )


def _build_review_report(
    *,
    request: TrainerPlanRequest,
    draft: TrainerPlanDraft,
    iterations: list[PlanReviewIteration],
    max_review_iterations: int,
    final_status: str,
    unresolved_personas: list[str],
) -> dict[str, Any]:
    serialized_iterations: list[dict[str, Any]] = []
    for record in iterations:
        serialized_iterations.append(
            {
                "iteration": record.iteration,
                "planner_step_name": record.planner_step_name,
                "plan_payload": record.plan_payload,
                "approved": record.approved,
                "reviews": [
                    asdict(record.arnold_review),
                    asdict(record.doctor_mike_review),
                ],
            }
        )

    return {
        "generated_on": date.today().isoformat(),
        "target_plan_version": request.plan_version,
        "workflow_name": request.workflow_name,
        "trace_id": request.trace_id,
        "session_id": request.session_id,
        "planner_backend": f"{draft.provider}/{draft.model_name}",
        "max_review_iterations": max_review_iterations,
        "iterations_ran": len(iterations),
        "final_status": final_status,
        "unresolved_personas": unresolved_personas,
        "iterations": serialized_iterations,
    }


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

    day = WorkoutDay(
        day_label=day_label,
        focus=_require_text(value, "focus", scope=f"day {index}"),
        warmup=_require_text(value, "warmup", scope=f"day {index}"),
        warmup_active_seconds=_require_positive_int(
            value, "warmup_active_seconds", scope=f"day {index}"
        ),
        exercises=exercises,
        finisher=_require_text(value, "finisher", scope=f"day {index}"),
        finisher_active_seconds=_require_positive_int(
            value, "finisher_active_seconds", scope=f"day {index}"
        ),
        recovery=_require_text(value, "recovery", scope=f"day {index}"),
        recovery_active_seconds=_require_positive_int(
            value, "recovery_active_seconds", scope=f"day {index}"
        ),
    )
    LOGGER.info(
        "Normalized day %s timing: warmup=%ss finisher=%ss recovery=%ss",
        index,
        day.warmup_active_seconds,
        day.finisher_active_seconds,
        day.recovery_active_seconds,
    )
    return day


def _normalize_exercise(value: Any, *, day_index: int) -> Exercise:
    if not isinstance(value, dict):
        raise WorkoutPlannerError(f"Day {day_index} includes an invalid exercise entry")

    exercise = Exercise(
        name=_require_text(value, "name", scope=f"day {day_index} exercise"),
        prescription=_require_text(
            value,
            "prescription",
            scope=f"day {day_index} exercise",
        ),
        notes=_require_text(value, "notes", scope=f"day {day_index} exercise"),
        sets=_require_positive_int(value, "sets", scope=f"day {day_index} exercise"),
        active_seconds=_require_positive_int(
            value, "active_seconds", scope=f"day {day_index} exercise"
        ),
        rest_between_sets_seconds=_require_positive_int(
            value,
            "rest_between_sets_seconds",
            scope=f"day {day_index} exercise",
        ),
        rest_between_exercises_seconds=_require_positive_int(
            value,
            "rest_between_exercises_seconds",
            scope=f"day {day_index} exercise",
        ),
    )
    LOGGER.info(
        "Normalized day %s exercise '%s' timing: sets=%s active=%ss rest_set=%ss rest_exercise=%ss",
        day_index,
        exercise.name,
        exercise.sets,
        exercise.active_seconds,
        exercise.rest_between_sets_seconds,
        exercise.rest_between_exercises_seconds,
    )
    return exercise


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


def _require_positive_int(
    value: dict[str, Any],
    key: str,
    *,
    scope: str = "plan",
) -> int:
    raw = value.get(key)
    if isinstance(raw, bool) or not isinstance(raw, int) or raw <= 0:
        raise WorkoutPlannerError(
            f"The {scope} is missing a usable positive integer '{key}' field"
        )
    return raw


def _clean_text(value: Any) -> str:
    if not isinstance(value, str):
        return ""
    return " ".join(value.strip().split())
