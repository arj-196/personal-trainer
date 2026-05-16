from __future__ import annotations

from fastapi.testclient import TestClient

from personal_trainer.api import app


def test_trainer_api_rejects_missing_token(monkeypatch) -> None:
    monkeypatch.setenv("TRAINER_API_TOKEN", "secret")
    client = TestClient(app)

    response = client.get("/workout-plan-generations/11111111-1111-4111-8111-111111111111")

    assert response.status_code == 401


def test_trainer_api_returns_generation_job(monkeypatch) -> None:
    monkeypatch.setenv("TRAINER_API_TOKEN", "secret")
    monkeypatch.setattr(
        "personal_trainer.api.get_job",
        lambda job_id: type(
            "Job",
            (),
            {
                "id": job_id,
                "workspace_slug": "wk_jordan",
                "status": "running",
                "current_step": "planner_initial",
                "target_plan_version": 2,
                "planner_provider": "openai",
                "planner_model": "gpt-5.4-mini",
                "workout_plan_id": None,
                "step_history": [],
                "review_feed": [],
                "error_message": None,
                "created_at": __import__("datetime").datetime.now(__import__("datetime").timezone.utc),
                "started_at": None,
                "finished_at": None,
                "updated_at": __import__("datetime").datetime.now(__import__("datetime").timezone.utc),
            },
        )(),
    )
    client = TestClient(app)

    response = client.get(
        "/workout-plan-generations/11111111-1111-4111-8111-111111111111",
        headers={"Authorization": "Bearer secret"},
    )

    assert response.status_code == 200
    assert response.json()["job"]["workspace"] == "wk_jordan"
