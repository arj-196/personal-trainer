from __future__ import annotations

from datetime import datetime, timezone

from personal_trainer.generation_jobs import review_feed_from_report, serialize_job
from personal_trainer.generation_jobs import WorkoutPlanGenerationJob


def test_review_feed_from_report_serializes_curated_reviewer_entries() -> None:
    feed = review_feed_from_report(
        {
            "iterations": [
                {
                    "iteration": 1,
                    "reviews": [
                        {
                            "persona": "Arnold Schwarzenegger",
                            "approved": False,
                            "reasoning_summary": "Needs more progressive overload.",
                            "blocking_issues": ["Back volume is too low."],
                            "suggested_changes": ["Add a horizontal pull."],
                        },
                        {
                            "persona": "Doctor Mike",
                            "approved": True,
                            "reasoning_summary": "Reasonable from a recovery standpoint.",
                            "blocking_issues": [],
                            "suggested_changes": ["Keep knee volume conservative."],
                        },
                    ],
                }
            ]
        }
    )

    assert feed[0]["reviewer"] == "Arnold Schwarzenegger"
    assert feed[0]["status"] == "changes_requested"
    assert feed[0]["blockingIssues"] == ["Back volume is too low."]
    assert feed[1]["reviewer"] == "Doctor Mike"
    assert feed[1]["status"] == "approved"
    assert feed[1]["suggestedChanges"] == ["Keep knee volume conservative."]


def test_serialize_job_exposes_camel_case_api_shape() -> None:
    now = datetime(2026, 5, 16, 12, 0, tzinfo=timezone.utc)
    job = WorkoutPlanGenerationJob(
        id="job-1",
        workspace_slug="wk_jordan",
        status="running",
        current_step="review_arnold_iter_1",
        target_plan_version=3,
        planner_provider="openai",
        planner_model="gpt-5.4-mini",
        workout_plan_id=None,
        step_history=[{"step": "queued", "status": "completed", "label": "Queued", "createdAt": "now"}],
        review_feed=[],
        error_message=None,
        created_at=now,
        started_at=now,
        finished_at=None,
        updated_at=now,
    )

    payload = serialize_job(job)

    assert payload["id"] == "job-1"
    assert payload["workspace"] == "wk_jordan"
    assert payload["currentStep"] == "review_arnold_iter_1"
    assert payload["targetPlanVersion"] == 3
    assert payload["workoutPlanId"] is None
    assert payload["stepHistory"][0]["label"] == "Queued"
