from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from personal_trainer import db

LOGGER = logging.getLogger(__name__)

ACTIVE_JOB_STATUSES = ("queued", "running")
TERMINAL_JOB_STATUSES = ("succeeded", "failed")


@dataclass(frozen=True, slots=True)
class WorkoutPlanGenerationJob:
    id: str
    workspace_slug: str
    status: str
    current_step: str
    target_plan_version: int
    planner_provider: str
    planner_model: str
    workout_plan_id: str | None
    step_history: list[dict[str, Any]]
    review_feed: list[dict[str, Any]]
    error_message: str | None
    created_at: datetime
    started_at: datetime | None
    finished_at: datetime | None
    updated_at: datetime


def create_or_get_active_job(
    workspace_slug: str,
    *,
    target_plan_version: int,
    planner_provider: str,
    planner_model: str,
    database_url: str | None = None,
) -> tuple[WorkoutPlanGenerationJob, bool]:
    """Create a generation job unless the workspace already has one active."""
    now = datetime.now(timezone.utc)
    with db.connect(database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT j.*, w.slug AS workspace_slug
                FROM workout_plan_generation_jobs j
                JOIN workspaces w ON w.id = j.workspace_id
                WHERE w.slug = %s
                  AND j.status IN ('queued', 'running')
                ORDER BY j.created_at DESC
                LIMIT 1
                """,
                (workspace_slug,),
            )
            row = cursor.fetchone()
            if row is not None:
                LOGGER.info("Reusing active workout plan generation job %s", row["id"])
                return _job_from_row(row), False

            cursor.execute(
                """
                INSERT INTO workout_plan_generation_jobs (
                    workspace_id, status, current_step, target_plan_version,
                    planner_provider, planner_model, step_history, created_at, updated_at
                )
                SELECT w.id, 'queued', 'queued', %s, %s, %s, %s::jsonb, %s, %s
                FROM workspaces w
                WHERE w.slug = %s
                RETURNING *, %s AS workspace_slug
                """,
                (
                    target_plan_version,
                    planner_provider,
                    planner_model,
                    json.dumps(
                        [
                            {
                                "step": "queued",
                                "status": "completed",
                                "label": "Generation request queued",
                                "createdAt": _iso(now),
                            }
                        ]
                    ),
                    now,
                    now,
                    workspace_slug,
                    workspace_slug,
                ),
            )
            row = cursor.fetchone()
            if row is None:
                raise RuntimeError(f"Workspace '{workspace_slug}' does not exist.")
        connection.commit()
    LOGGER.info("Created workout plan generation job %s", row["id"])
    return _job_from_row(row), True


def get_job(job_id: str, *, database_url: str | None = None) -> WorkoutPlanGenerationJob | None:
    with db.connect(database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT j.*, w.slug AS workspace_slug
                FROM workout_plan_generation_jobs j
                JOIN workspaces w ON w.id = j.workspace_id
                WHERE j.id = %s
                """,
                (job_id,),
            )
            row = cursor.fetchone()
            return _job_from_row(row) if row is not None else None


def get_active_job(
    workspace_slug: str,
    *,
    database_url: str | None = None,
) -> WorkoutPlanGenerationJob | None:
    with db.connect(database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT j.*, w.slug AS workspace_slug
                FROM workout_plan_generation_jobs j
                JOIN workspaces w ON w.id = j.workspace_id
                WHERE w.slug = %s
                  AND j.status IN ('queued', 'running')
                ORDER BY j.created_at DESC
                LIMIT 1
                """,
                (workspace_slug,),
            )
            row = cursor.fetchone()
            return _job_from_row(row) if row is not None else None


def mark_job_running(job_id: str, *, database_url: str | None = None) -> None:
    append_step(
        job_id,
        step="starting",
        status="running",
        label="Preparing workout plan generation",
        database_url=database_url,
    )
    now = datetime.now(timezone.utc)
    with db.connect(database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE workout_plan_generation_jobs
                SET status = 'running',
                    current_step = 'starting',
                    started_at = COALESCE(started_at, %s),
                    updated_at = %s
                WHERE id = %s
                """,
                (now, now, job_id),
            )
        connection.commit()


def append_step(
    job_id: str,
    *,
    step: str,
    status: str,
    label: str,
    database_url: str | None = None,
) -> None:
    event = {
        "step": step,
        "status": status,
        "label": label,
        "createdAt": _iso(datetime.now(timezone.utc)),
    }
    LOGGER.info("Updating generation job %s step: %s", job_id, step)
    with db.connect(database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE workout_plan_generation_jobs
                SET current_step = %s,
                    step_history = step_history || %s::jsonb,
                    updated_at = %s
                WHERE id = %s
                """,
                (step, json.dumps([event]), datetime.now(timezone.utc), job_id),
            )
        connection.commit()


def mark_job_succeeded(
    job_id: str,
    *,
    workout_plan_id: str | None,
    review_feed: list[dict[str, Any]],
    reached_max_iterations: bool,
    database_url: str | None = None,
) -> None:
    final_step = "published_with_warnings" if reached_max_iterations else "published"
    append_step(
        job_id,
        step=final_step,
        status="completed",
        label=(
            "Published Workout Plan with reviewer warnings"
            if reached_max_iterations
            else "Published new Workout Plan"
        ),
        database_url=database_url,
    )
    now = datetime.now(timezone.utc)
    with db.connect(database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE workout_plan_generation_jobs
                SET status = 'succeeded',
                    current_step = %s,
                    workout_plan_id = %s,
                    review_feed = %s::jsonb,
                    finished_at = %s,
                    updated_at = %s
                WHERE id = %s
                """,
                (final_step, workout_plan_id, json.dumps(review_feed), now, now, job_id),
            )
        connection.commit()


def mark_job_failed(
    job_id: str,
    *,
    error_message: str,
    database_url: str | None = None,
) -> None:
    append_step(
        job_id,
        step="failed",
        status="failed",
        label="Workout Plan generation failed",
        database_url=database_url,
    )
    now = datetime.now(timezone.utc)
    with db.connect(database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE workout_plan_generation_jobs
                SET status = 'failed',
                    current_step = 'failed',
                    error_message = %s,
                    finished_at = %s,
                    updated_at = %s
                WHERE id = %s
                """,
                (error_message, now, now, job_id),
            )
        connection.commit()


def review_feed_from_report(report: dict[str, Any]) -> list[dict[str, Any]]:
    created_at = _iso(datetime.now(timezone.utc))
    feed: list[dict[str, Any]] = []
    for iteration in report.get("iterations", []):
        if not isinstance(iteration, dict):
            continue
        iteration_number = int(iteration.get("iteration") or 0)
        for review in iteration.get("reviews", []):
            if not isinstance(review, dict):
                continue
            approved = bool(review.get("approved"))
            feed.append(
                {
                    "iteration": iteration_number,
                    "reviewer": str(review.get("persona") or "Reviewer"),
                    "status": "approved" if approved else "changes_requested",
                    "reasoningSummary": str(review.get("reasoning_summary") or ""),
                    "blockingIssues": _string_list(review.get("blocking_issues")),
                    "suggestedChanges": _string_list(review.get("suggested_changes")),
                    "createdAt": created_at,
                }
            )
    return feed


def serialize_job(job: WorkoutPlanGenerationJob) -> dict[str, Any]:
    return {
        "id": job.id,
        "workspace": job.workspace_slug,
        "status": job.status,
        "currentStep": job.current_step,
        "targetPlanVersion": job.target_plan_version,
        "plannerProvider": job.planner_provider,
        "plannerModel": job.planner_model,
        "workoutPlanId": job.workout_plan_id,
        "stepHistory": job.step_history,
        "reviewFeed": job.review_feed,
        "errorMessage": job.error_message,
        "createdAt": _iso(job.created_at),
        "startedAt": _iso(job.started_at) if job.started_at else None,
        "finishedAt": _iso(job.finished_at) if job.finished_at else None,
        "updatedAt": _iso(job.updated_at),
    }


def _job_from_row(row: dict[str, Any]) -> WorkoutPlanGenerationJob:
    return WorkoutPlanGenerationJob(
        id=str(row["id"]),
        workspace_slug=str(row["workspace_slug"]),
        status=str(row["status"]),
        current_step=str(row["current_step"]),
        target_plan_version=int(row["target_plan_version"]),
        planner_provider=str(row["planner_provider"]),
        planner_model=str(row["planner_model"]),
        workout_plan_id=str(row["workout_plan_id"]) if row["workout_plan_id"] else None,
        step_history=_json_list(row["step_history"]),
        review_feed=_json_list(row["review_feed"]),
        error_message=str(row["error_message"]) if row["error_message"] else None,
        created_at=row["created_at"],
        started_at=row["started_at"],
        finished_at=row["finished_at"],
        updated_at=row["updated_at"],
    )


def _json_list(value: Any) -> list[dict[str, Any]]:
    if isinstance(value, str):
        value = json.loads(value)
    return value if isinstance(value, list) else []


def _string_list(value: Any) -> list[str]:
    return [str(item) for item in value] if isinstance(value, list) else []


def _iso(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
