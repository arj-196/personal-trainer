from __future__ import annotations

from fastapi.testclient import TestClient

from personal_trainer.models import UserProfile
from personal_trainer.api import app
from personal_trainer.workout_session_chat import WorkoutSessionChatResponse


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


def test_workout_session_chat_uses_configured_chat_model(monkeypatch) -> None:
    monkeypatch.setenv("TRAINER_API_TOKEN", "secret")
    monkeypatch.setenv("OPENAI_API_KEY", "openai-secret")
    monkeypatch.setenv("TRAINER_CHAT_OPENAI_MODEL", "gpt-cheap-chat")
    monkeypatch.setattr(
        "personal_trainer.api.read_profile",
        lambda workspace: UserProfile(name="Jordan"),
    )
    monkeypatch.setattr(
        "personal_trainer.api.read_current_rendered_workout_plan",
        lambda workspace: {"days": [{"heading": "Day 1", "exercises": []}]},
    )
    captured = {}

    class FakeOpenAIChatClient:
        def __init__(self, config):
            captured["model"] = config.model

    monkeypatch.setattr("personal_trainer.api.OpenAIChatClient", FakeOpenAIChatClient)
    monkeypatch.setattr(
        "personal_trainer.api.answer_workout_session_chat",
        lambda request, profile, rendered_plan, client: WorkoutSessionChatResponse(
            arnold_response="Arnold answer.",
        ),
    )
    client = TestClient(app)

    response = client.post(
        "/workspaces/wk_jordan/workout-session-chat",
        headers={"Authorization": "Bearer secret"},
        json={"dayHeading": "Day 1", "question": "What muscles?", "history": []},
    )

    assert response.status_code == 200
    assert response.json() == {
        "arnoldResponse": "Arnold answer.",
    }
    assert captured["model"] == "gpt-cheap-chat"


def test_workout_session_chat_returns_404_without_current_plan(monkeypatch) -> None:
    monkeypatch.setenv("TRAINER_API_TOKEN", "secret")
    monkeypatch.setenv("OPENAI_API_KEY", "openai-secret")
    monkeypatch.setattr(
        "personal_trainer.api.read_profile",
        lambda workspace: UserProfile(name="Jordan"),
    )
    monkeypatch.setattr(
        "personal_trainer.api.read_current_rendered_workout_plan",
        lambda workspace: None,
    )
    client = TestClient(app)

    response = client.post(
        "/workspaces/wk_jordan/workout-session-chat",
        headers={"Authorization": "Bearer secret"},
        json={"dayHeading": "Day 1", "question": "What muscles?", "history": []},
    )

    assert response.status_code == 404


def test_workout_session_chat_rejects_missing_token(monkeypatch) -> None:
    monkeypatch.setenv("TRAINER_API_TOKEN", "secret")
    client = TestClient(app)

    response = client.post(
        "/workspaces/wk_jordan/workout-session-chat",
        json={"dayHeading": "Day 1", "question": "What muscles?", "history": []},
    )

    assert response.status_code == 401
