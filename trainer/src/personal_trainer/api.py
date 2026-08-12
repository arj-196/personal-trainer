from __future__ import annotations

import logging
import os
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from fastapi import BackgroundTasks, Depends, FastAPI, Header, HTTPException, status
from pydantic import BaseModel, Field

from personal_trainer.db import (
    latest_checkin,
    next_plan_version,
    read_current_rendered_workout_plan,
    read_profile,
    save_workout_plan,
)
from personal_trainer.generation_jobs import (
    append_step,
    create_or_get_active_job,
    get_active_job,
    get_job,
    mark_job_failed,
    mark_job_running,
    mark_job_succeeded,
    review_feed_from_report,
    serialize_job,
)
from personal_trainer.llm import start_session
from personal_trainer.llm_client import DEFAULT_BASE_URL, LlmChatClient, LlmClientConfig
from personal_trainer.workout_session_chat import (
    WorkoutSessionChatError,
    WorkoutSessionChatRequest,
    WorkoutSessionChatTurn,
    answer_workout_session_chat,
)
from personal_trainer.workout_planner import (
    LlmTrainerAgent,
    TrainerAgent,
    TrainerPlanDraft,
    TrainerPlanRequest,
    WorkoutPlannerError,
    build_plan_with_review,
)

LOGGER = logging.getLogger(__name__)
app = FastAPI(title="Personal Trainer API")
EXECUTOR = ThreadPoolExecutor(max_workers=int(os.getenv("TRAINER_API_WORKERS", "2")))
DEFAULT_MODEL = "deepseek/deepseek-v4-flash"


def _resolve_model(stored_model: str | None, env_default: str) -> str:
    """Resolve the planner model, ignoring legacy bare OpenAI names.

    Jobs created before the OpenRouter cutover persisted un-prefixed model
    names like 'gpt-5.4-mini' that OpenRouter does not recognize.
    """
    model = (stored_model or "").strip()
    if model and "/" in model:
        return model
    return env_default


class WorkoutSessionChatTurnPayload(BaseModel):
    question: str = Field(default="", max_length=800)
    arnoldResponse: str = Field(default="", max_length=1200)


class WorkoutSessionChatPayload(BaseModel):
    dayHeading: str = Field(default="", max_length=200)
    question: str = Field(default="", max_length=800)
    history: list[WorkoutSessionChatTurnPayload] = Field(default_factory=list, max_length=8)


def _require_service_token(authorization: str | None = Header(default=None)) -> None:
    expected = os.getenv("TRAINER_API_TOKEN", "").strip()
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="TRAINER_API_TOKEN is not configured.",
        )
    if authorization != f"Bearer {expected}":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid trainer API token.",
        )


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post(
    "/workspaces/{workspace}/workout-plan-generations",
    dependencies=[Depends(_require_service_token)],
)
def create_workout_plan_generation(
    workspace: str,
    background_tasks: BackgroundTasks,
) -> dict[str, Any]:
    provider = "openrouter"
    model = os.getenv("TRAINER_MODEL", DEFAULT_MODEL)
    try:
        plan_version = next_plan_version(workspace)
        job, created = create_or_get_active_job(
            workspace,
            target_plan_version=plan_version,
            planner_provider=provider,
            planner_model=model,
        )
    except RuntimeError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error

    if created:
        LOGGER.info("Scheduling workout plan generation job %s", job.id)
        background_tasks.add_task(_submit_generation_job, job.id)
    return {"job": serialize_job(job), "created": created}


@app.get(
    "/workspaces/{workspace}/workout-plan-generations/active",
    dependencies=[Depends(_require_service_token)],
)
def get_active_workout_plan_generation(workspace: str) -> dict[str, Any]:
    job = get_active_job(workspace)
    return {"job": serialize_job(job) if job is not None else None}


@app.get(
    "/workout-plan-generations/{job_id}",
    dependencies=[Depends(_require_service_token)],
)
def get_workout_plan_generation(job_id: str) -> dict[str, Any]:
    job = get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Generation job not found.")
    return {"job": serialize_job(job)}


@app.post(
    "/workspaces/{workspace}/workout-session-chat",
    dependencies=[Depends(_require_service_token)],
)
def create_workout_session_chat(
    workspace: str,
    payload: WorkoutSessionChatPayload,
) -> dict[str, str]:
    try:
        profile = read_profile(workspace)
    except RuntimeError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error

    rendered_plan = read_current_rendered_workout_plan(workspace)
    if rendered_plan is None:
        raise HTTPException(
            status_code=404,
            detail=f"Workspace '{workspace}' does not have a current Workout Plan.",
        )

    api_key = os.getenv("OPENROUTER_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="OPENROUTER_API_KEY is required for Workout Session chat.",
        )

    model = os.getenv(
        "TRAINER_CHAT_MODEL",
        os.getenv("TRAINER_MODEL", DEFAULT_MODEL),
    )
    base_url = os.getenv("LLM_BASE_URL", DEFAULT_BASE_URL)
    timeout_seconds = int(os.getenv("TRAINER_CHAT_TIMEOUT_SECONDS", "45"))
    client = LlmChatClient(
        LlmClientConfig(
            api_key=api_key,
            model=model,
            base_url=base_url,
            timeout_seconds=max(10, timeout_seconds),
            temperature=0.2,
        )
    )
    request = WorkoutSessionChatRequest(
        workspace=workspace,
        day_heading=payload.dayHeading,
        question=payload.question,
        history=tuple(
            WorkoutSessionChatTurn(
                question=turn.question,
                arnold_response=turn.arnoldResponse,
            )
            for turn in payload.history
        ),
    )
    try:
        response = answer_workout_session_chat(
            request,
            profile=profile,
            rendered_plan=rendered_plan,
            client=client,
        )
    except WorkoutSessionChatError as error:
        message = str(error)
        status_code = 400
        if "LLM" in message or "could not reach" in message or "timed out" in message:
            status_code = 502
        LOGGER.warning(
            "Workout Session chat failed",
            extra={"workspace": workspace, "error": message},
        )
        raise HTTPException(status_code=status_code, detail=message) from error

    LOGGER.info("Workout Session chat answered", extra={"workspace": workspace})
    return {
        "arnoldResponse": response.arnold_response,
    }


def _submit_generation_job(job_id: str) -> None:
    EXECUTOR.submit(_run_generation_job, job_id)


def _run_generation_job(job_id: str) -> None:
    job = get_job(job_id)
    if job is None:
        LOGGER.error("Workout plan generation job disappeared before running", extra={"job_id": job_id})
        return

    try:
        mark_job_running(job_id)
        workspace = job.workspace_slug
        profile = read_profile(workspace)
        checkin = latest_checkin(workspace)
        if checkin is None:
            LOGGER.info("Generating Workout Plan without a Check-in", extra={"workspace": workspace})
        else:
            LOGGER.info(
                "Generating Workout Plan with latest Check-in",
                extra={"workspace": workspace, "check_in_date": checkin.check_in_date.isoformat()},
            )
        api_key = os.getenv("OPENROUTER_API_KEY", "").strip()
        if not api_key:
            raise WorkoutPlannerError("OPENROUTER_API_KEY is required for web-triggered generation.")

        model = _resolve_model(job.planner_model, os.getenv("TRAINER_MODEL", DEFAULT_MODEL))
        base_url = os.getenv("LLM_BASE_URL", DEFAULT_BASE_URL)
        timeout_seconds = int(os.getenv("TRAINER_TIMEOUT_SECONDS", "180"))
        max_review_iterations = int(os.getenv("TRAINER_PLAN_REVIEW_MAX_ITERATIONS", "5"))
        agent = _JobTrackingAgent(
            LlmTrainerAgent(
                LlmChatClient(
                    LlmClientConfig(
                        api_key=api_key,
                        model=model,
                        base_url=base_url,
                        timeout_seconds=max(30, timeout_seconds),
                    )
                )
            ),
            job_id=job_id,
        )
        result = build_plan_with_review(
            profile,
            plan_version=job.target_plan_version,
            checkin=checkin,
            agent=agent,
            workflow_name="weekly_plan_generation",
            session_id=start_session("weekly_plan_generation"),
            max_review_iterations=max_review_iterations,
        )
        append_step(
            job_id,
            step="publishing",
            status="running",
            label="Publishing the new Workout Plan",
        )
        plan_id = save_workout_plan(workspace, result.plan, profile)
        mark_job_succeeded(
            job_id,
            workout_plan_id=plan_id,
            review_feed=review_feed_from_report(result.review_report),
            reached_max_iterations=result.reached_max_iterations,
        )
        LOGGER.info("Workout plan generation job succeeded", extra={"job_id": job_id})
    except Exception as error:
        LOGGER.exception("Workout plan generation job failed", extra={"job_id": job_id})
        mark_job_failed(job_id, error_message=str(error))


class _JobTrackingAgent:
    def __init__(self, wrapped: TrainerAgent, *, job_id: str) -> None:
        self._wrapped = wrapped
        self._job_id = job_id
        self.model_name = wrapped.model_name

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
        append_step(
            self._job_id,
            step=step_name,
            status="running",
            label=_step_label(step_name),
        )
        draft = self._wrapped.run_json_step(
            request,
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            schema=schema,
            step_name=step_name,
            metadata=metadata,
        )
        append_step(
            self._job_id,
            step=step_name,
            status="completed",
            label=_step_completed_label(step_name),
        )
        return draft


def _step_label(step_name: str) -> str:
    if step_name == "planner_initial":
        return "Drafting the Workout Plan"
    if step_name.startswith("review_arnold"):
        return "Arnold is reviewing the plan"
    if step_name.startswith("review_doctor_mike"):
        return "Doctor Mike is reviewing the plan"
    if step_name.startswith("planner_revision"):
        return "Revising the plan from reviewer feedback"
    return step_name.replace("_", " ").title()


def _step_completed_label(step_name: str) -> str:
    if step_name == "planner_initial":
        return "Draft plan completed"
    if step_name.startswith("review_arnold"):
        return "Arnold review completed"
    if step_name.startswith("review_doctor_mike"):
        return "Doctor Mike review completed"
    if step_name.startswith("planner_revision"):
        return "Plan revision completed"
    return f"{_step_label(step_name)} completed"
