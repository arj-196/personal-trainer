from __future__ import annotations

import json
from datetime import date

import pytest
from click.testing import CliRunner

from personal_trainer.blob_sync import BlobPublishResult
from personal_trainer.cli import main
from personal_trainer.markdown_io import load_state


def _stub_plan_payload(day_count: int) -> dict[str, object]:
    days = []
    for index in range(day_count):
        days.append(
            {
                "day_label": f"Day {index + 1}",
                "focus": "Upper strength" if index == 0 else f"Session {index + 1}",
                "warmup": "5 minutes easy cardio and 2 ramp-up sets.",
                "warmup_active_seconds": 300,
                "exercises": [
                    {
                        "name": "Dumbbell Bench Press",
                        "prescription": "3 sets x 8-10 reps",
                        "notes": "Stop with 1-2 reps in reserve.",
                        "sets": 3,
                        "active_seconds": 45,
                        "rest_between_sets_seconds": 90,
                        "rest_between_exercises_seconds": 120,
                    },
                    {
                        "name": "1-Arm Dumbbell Row",
                        "prescription": "3 sets x 8-10 reps",
                        "notes": "Control the lowering phase.",
                        "sets": 3,
                        "active_seconds": 40,
                        "rest_between_sets_seconds": 75,
                        "rest_between_exercises_seconds": 120,
                    },
                ],
                "finisher": "8 minutes on the bike at a conversational pace.",
                "finisher_active_seconds": 480,
                "recovery": "Monitor symptoms and keep the next day easy if needed.",
                "recovery_active_seconds": 300,
            }
        )
    return {
        "summary": "This week prioritizes sustainable progress and repeatable sessions.",
        "progression_note": "Add reps before load when technique stays clean.",
        "next_checkin_prompt": "At week end, log adherence, energy, soreness, and any pain changes.",
        "coach_notes_focus": [
            "Keep effort honest and stop sets before breakdown.",
            "Use the warm-up to gauge readiness before working sets.",
        ],
        "coach_notes_cautions": ["Back off any movement that causes sharp pain."],
        "days": days,
    }


def _stub_review_payload(approved: bool) -> dict[str, object]:
    return {
        "approved": approved,
        "blocking_issues": [] if approved else ["Issue requires revision."],
        "suggested_changes": ["Tighten progression and recovery guidance."],
        "reasoning_summary": "Reviewer decision.",
    }


def _is_review_schema(schema: dict[str, object]) -> bool:
    properties = schema.get("properties")
    return isinstance(properties, dict) and "approved" in properties


def _install_stub_ollama(
    monkeypatch,
    *,
    day_count: int = 3,
    review_approved: bool = True,
) -> None:
    def fake_chat_json(self, *, system_prompt, user_prompt, schema):
        if _is_review_schema(schema):
            return _stub_review_payload(review_approved)
        payload = _stub_plan_payload(day_count)
        payload["summary"] = f"Ollama plan for {self.config.model}"
        return payload

    monkeypatch.setattr(
        "personal_trainer.ollama_client.OllamaChatClient.chat_json",
        fake_chat_json,
    )


def _install_stub_openai(
    monkeypatch,
    *,
    day_count: int = 3,
    review_approved: bool = True,
) -> None:
    def fake_chat_json(self, *, system_prompt, user_prompt, schema):
        if _is_review_schema(schema):
            return _stub_review_payload(review_approved)
        payload = _stub_plan_payload(day_count)
        payload["summary"] = f"OpenAI plan for {self.config.model}"
        return payload

    monkeypatch.setattr(
        "personal_trainer.openai_client.OpenAIChatClient.chat_json",
        fake_chat_json,
    )


def test_init_and_plan_flow(tmp_path, monkeypatch) -> None:
    workspaces_root = tmp_path / "workspaces"
    workspace = workspaces_root / "athlete"
    monkeypatch.setattr("personal_trainer.cli.WORKSPACES_ROOT", workspaces_root)
    _install_stub_ollama(monkeypatch, day_count=3)
    runner = CliRunner()

    result = runner.invoke(main, ["init", "athlete"])
    assert result.exit_code == 0
    assert (workspace / "profile.md").exists()
    assert (workspace / "profile.json").exists()

    profile = (workspace / "profile.md").read_text(encoding="utf-8")
    profile = profile.replace("Albert", "Jordan").replace(
        "Days per week: 4", "Days per week: 3"
    )
    (workspace / "profile.md").write_text(profile, encoding="utf-8")
    (workspace / "plan.pdf").write_bytes(b"%PDF-1.4\n")

    result = runner.invoke(main, ["plan", "athlete"])
    assert result.exit_code == 0
    assert (workspace / "plan.md").exists()
    assert not (workspace / "plan.pdf").exists()
    assert (workspace / "plan.json").exists()
    assert (workspace / "plan_review.json").exists()
    assert (workspace / "coach_notes.md").exists()
    assert list((workspace / "checkins").glob("*-checkin.md")) == []

    assert "Plan written" in result.output
    assert "plan_review.json" in result.output
    plan_text = (workspace / "plan.md").read_text(encoding="utf-8")
    plan_json = (workspace / "plan.json").read_text(encoding="utf-8")
    assert "https://wger.de/media/exercise-images/" in plan_text
    assert '"days": [' in plan_json
    assert '"imageUrl": "https://wger.de/media/exercise-images/' in plan_json
    assert '"referencePath":' not in plan_json
    assert '"activeSeconds": 45' in plan_json
    assert '"restBetweenSetsSeconds": 90' in plan_json


def test_plan_uses_latest_checkin_and_updates_state(tmp_path, monkeypatch) -> None:
    workspaces_root = tmp_path / "workspaces"
    workspace = workspaces_root / "athlete"
    monkeypatch.setattr("personal_trainer.cli.WORKSPACES_ROOT", workspaces_root)
    _install_stub_ollama(monkeypatch, day_count=3)
    runner = CliRunner()

    assert runner.invoke(main, ["init", "athlete"]).exit_code == 0
    assert runner.invoke(main, ["plan", "athlete"]).exit_code == 0
    (workspace / "plan.pdf").write_bytes(b"%PDF-1.4\n")

    older_checkin = workspace / "checkins" / "2026-03-30-checkin.md"
    older_checkin.write_text(
        """# Weekly Check-In

## Summary
- Date: 2026-03-30
- Workouts completed: 3
- Workouts planned: 3
- Average difficulty (1-10): 6
- Energy (1-10): 8
- Soreness (1-10): 3
- Body weight kg: 80.5

## Wins
- Felt strong on pressing work.

## Struggles
- None.

## Notes
- Recovery was solid.
""",
        encoding="utf-8",
    )
    latest_checkin = workspace / "checkins" / "2026-04-06-checkin.md"
    latest_checkin.write_text(
        """# Weekly Check-In

## Summary
- Date: 2026-04-06
- Workouts completed: 2
- Workouts planned: 3
- Average difficulty (1-10): 8
- Energy (1-10): 6
- Soreness (1-10): 7
- Body weight kg: 80.2

## Wins
- Completed all warmups.

## Struggles
- Missed one session.

## Notes
- Felt more fatigue this week.
""",
        encoding="utf-8",
    )
    (workspace / "checkins" / "notes.md").write_text("ignore me", encoding="utf-8")
    (workspace / "checkins" / "2026-04-07-checkin.txt").write_text(
        "ignore me too",
        encoding="utf-8",
    )

    result = runner.invoke(main, ["plan", "athlete"])
    assert result.exit_code == 0
    state = load_state(workspace / ".trainer" / "state.json")

    assert state.plan_version == 2
    assert state.generated_plans == 2
    assert state.last_check_in == "2026-04-06"
    assert "Plan version: 2" in (workspace / "plan.md").read_text(encoding="utf-8")
    assert not (workspace / "plan.pdf").exists()
    assert '"value": "2"' in (workspace / "plan.json").read_text(encoding="utf-8")
    assert (workspace / "plan_review.json").exists()
    coach_notes = (workspace / "coach_notes.md").read_text(encoding="utf-8")
    assert "## Latest Check-In Read" in coach_notes
    assert "- Date: 2026-04-06" in coach_notes
    assert sorted(path.name for path in (workspace / "checkins").glob("*-checkin.md")) == [
        older_checkin.name,
        latest_checkin.name,
    ]


def test_plan_clears_last_checkin_when_no_checkins_exist(tmp_path, monkeypatch) -> None:
    workspaces_root = tmp_path / "workspaces"
    workspace = workspaces_root / "athlete"
    monkeypatch.setattr("personal_trainer.cli.WORKSPACES_ROOT", workspaces_root)
    _install_stub_ollama(monkeypatch, day_count=3)
    runner = CliRunner()

    assert runner.invoke(main, ["init", "athlete"]).exit_code == 0
    checkin = workspace / "checkins" / "2026-04-05-checkin.md"
    checkin.write_text(
        """# Weekly Check-In

## Summary
- Date: 2026-04-05
- Workouts completed: 3
- Workouts planned: 3
- Average difficulty (1-10): 6
- Energy (1-10): 7
- Soreness (1-10): 4
- Body weight kg: 79.9

## Wins
- Stayed consistent.

## Struggles
- None.

## Notes
- Good week.
""",
        encoding="utf-8",
    )

    first_result = runner.invoke(main, ["plan", "athlete"])
    assert first_result.exit_code == 0
    first_state = load_state(workspace / ".trainer" / "state.json")
    assert first_state.last_check_in == "2026-04-05"

    checkin.unlink()
    second_result = runner.invoke(main, ["plan", "athlete"])
    assert second_result.exit_code == 0
    second_state = load_state(workspace / ".trainer" / "state.json")
    assert second_state.plan_version == 2
    assert second_state.generated_plans == 2
    assert second_state.last_check_in is None
    coach_notes = (workspace / "coach_notes.md").read_text(encoding="utf-8")
    assert "## Latest Check-In Read" not in coach_notes


def test_plan_fails_when_latest_checkin_is_invalid(tmp_path, monkeypatch) -> None:
    workspaces_root = tmp_path / "workspaces"
    workspace = workspaces_root / "athlete"
    monkeypatch.setattr("personal_trainer.cli.WORKSPACES_ROOT", workspaces_root)
    _install_stub_ollama(monkeypatch, day_count=3)
    runner = CliRunner()

    assert runner.invoke(main, ["init", "athlete"]).exit_code == 0
    valid_older = workspace / "checkins" / "2026-04-01-checkin.md"
    valid_older.write_text(
        """# Weekly Check-In

## Summary
- Date: 2026-04-01
- Workouts completed: 3
- Workouts planned: 3
- Average difficulty (1-10): 6
- Energy (1-10): 7
- Soreness (1-10): 4
- Body weight kg: 80.1

## Wins
- Consistent.

## Struggles
- None.

## Notes
- Good adherence.
""",
        encoding="utf-8",
    )
    invalid_latest = workspace / "checkins" / "2026-04-10-checkin.md"
    invalid_latest.write_text(
        """# Weekly Check-In

## Summary
- Workouts completed: 2
- Workouts planned: 3
- Average difficulty (1-10): 8
- Energy (1-10): 5
- Soreness (1-10): 7

## Wins
- Tried hard.

## Struggles
- Fatigue.

## Notes
- Missing date on purpose.
""",
        encoding="utf-8",
    )

    result = runner.invoke(main, ["plan", "athlete"])
    assert result.exit_code != 0
    assert "Latest check-in" in result.output
    assert "invalid" in result.output
    assert str(invalid_latest) in result.output

    state = load_state(workspace / ".trainer" / "state.json")
    assert state.plan_version == 0
    assert state.generated_plans == 0
    assert state.last_check_in is None


def test_checkin_creates_today_file_with_plan_defaults(tmp_path, monkeypatch) -> None:
    workspaces_root = tmp_path / "workspaces"
    workspace = workspaces_root / "athlete"
    monkeypatch.setattr("personal_trainer.cli.WORKSPACES_ROOT", workspaces_root)
    runner = CliRunner()

    assert runner.invoke(main, ["init", "athlete"]).exit_code == 0
    (workspace / "plan.json").write_text(
        json.dumps({"days": [{}, {}, {}]}),
        encoding="utf-8",
    )

    result = runner.invoke(main, ["checkin", "athlete"])
    assert result.exit_code == 0

    today_path = workspace / "checkins" / f"{date.today().isoformat()}-checkin.md"
    assert today_path.exists()
    text = today_path.read_text(encoding="utf-8")
    assert f"- Date: {date.today().isoformat()}" in text
    assert "- Workouts completed: 3" in text
    assert "- Workouts planned: 3" in text


def test_checkin_creates_explicit_date_file(tmp_path, monkeypatch) -> None:
    workspaces_root = tmp_path / "workspaces"
    workspace = workspaces_root / "athlete"
    monkeypatch.setattr("personal_trainer.cli.WORKSPACES_ROOT", workspaces_root)
    runner = CliRunner()

    assert runner.invoke(main, ["init", "athlete"]).exit_code == 0

    result = runner.invoke(
        main,
        ["checkin", "athlete", "--date", "2026-04-10"],
    )
    assert result.exit_code == 0

    path = workspace / "checkins" / "2026-04-10-checkin.md"
    assert path.exists()
    text = path.read_text(encoding="utf-8")
    assert "- Date: 2026-04-10" in text


def test_checkin_defaults_to_zero_without_plan_json(tmp_path, monkeypatch) -> None:
    workspaces_root = tmp_path / "workspaces"
    workspace = workspaces_root / "athlete"
    monkeypatch.setattr("personal_trainer.cli.WORKSPACES_ROOT", workspaces_root)
    runner = CliRunner()

    assert runner.invoke(main, ["init", "athlete"]).exit_code == 0

    result = runner.invoke(main, ["checkin", "athlete", "--date", "2026-04-11"])
    assert result.exit_code == 0

    path = workspace / "checkins" / "2026-04-11-checkin.md"
    text = path.read_text(encoding="utf-8")
    assert "- Workouts completed: 0" in text
    assert "- Workouts planned: 0" in text


def test_checkin_fails_when_file_already_exists(tmp_path, monkeypatch) -> None:
    workspaces_root = tmp_path / "workspaces"
    workspace = workspaces_root / "athlete"
    monkeypatch.setattr("personal_trainer.cli.WORKSPACES_ROOT", workspaces_root)
    runner = CliRunner()

    assert runner.invoke(main, ["init", "athlete"]).exit_code == 0
    existing = workspace / "checkins" / "2026-04-12-checkin.md"
    existing.write_text("# Existing", encoding="utf-8")

    result = runner.invoke(main, ["checkin", "athlete", "--date", "2026-04-12"])
    assert result.exit_code != 0
    assert "Check-in already exists" in result.output


@pytest.mark.paid_openai
def test_plan_writes_comparison_files_for_multiple_models(
    tmp_path, monkeypatch
) -> None:
    workspaces_root = tmp_path / "workspaces"
    workspace = workspaces_root / "athlete"
    monkeypatch.setattr("personal_trainer.cli.WORKSPACES_ROOT", workspaces_root)
    _install_stub_ollama(monkeypatch, day_count=3)
    _install_stub_openai(monkeypatch, day_count=3)
    runner = CliRunner()

    assert runner.invoke(main, ["init", "athlete"]).exit_code == 0
    (workspace / "plan-ollama-gpt-oss-20b.pdf").write_bytes(b"%PDF-1.4\n")
    (workspace / "plan-openai-gpt-5-4-mini.pdf").write_bytes(b"%PDF-1.4\n")

    result = runner.invoke(
        main,
        [
            "plan",
            "athlete",
            "--ollama-model",
            "gpt-oss:20b",
            "--openai-model",
            "gpt-5.4-mini",
            "--openai-api-key",
            "test-key",
        ],
    )

    assert result.exit_code == 0
    ollama_plan = workspace / "plan-ollama-gpt-oss-20b.md"
    ollama_plan_json = workspace / "plan-ollama-gpt-oss-20b.json"
    ollama_review_json = workspace / "plan_review-ollama-gpt-oss-20b.json"
    openai_plan = workspace / "plan-openai-gpt-5-4-mini.md"
    openai_plan_json = workspace / "plan-openai-gpt-5-4-mini.json"
    openai_review_json = workspace / "plan_review-openai-gpt-5-4-mini.json"

    assert ollama_plan.exists()
    assert not (workspace / "plan-ollama-gpt-oss-20b.pdf").exists()
    assert ollama_plan_json.exists()
    assert ollama_review_json.exists()
    assert openai_plan.exists()
    assert not (workspace / "plan-openai-gpt-5-4-mini.pdf").exists()
    assert openai_plan_json.exists()
    assert openai_review_json.exists()
    assert "Generated by: ollama/gpt-oss:20b" in ollama_plan.read_text(encoding="utf-8")
    assert "Generated by: openai/gpt-5.4-mini" in openai_plan.read_text(
        encoding="utf-8"
    )
    assert '"value": "ollama/gpt-oss:20b"' in ollama_plan_json.read_text(
        encoding="utf-8"
    )
    assert '"value": "openai/gpt-5.4-mini"' in openai_plan_json.read_text(
        encoding="utf-8"
    )

    state = load_state(workspace / ".trainer" / "state.json")
    assert state.plan_version == 1
    assert state.generated_plans == 2

    llm_log_path = workspace / ".trainer" / "logs" / "llm_calls.jsonl"
    assert llm_log_path.exists()
    records = [
        json.loads(line)
        for line in llm_log_path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    assert len(records) == 6
    assert all(record["workflow_name"] == "weekly_plan_generation" for record in records)
    step_names = {record["step_name"] for record in records}
    assert "planner_initial" in step_names
    assert "review_arnold_iter_1" in step_names
    assert "review_doctor_mike_iter_1" in step_names
    assert all(record["success"] is True for record in records)
    assert all(record["session_id"] for record in records)
    assert len({record["session_id"] for record in records}) == 1


def test_plan_succeeds_with_langfuse_env_set_in_pytest(tmp_path, monkeypatch) -> None:
    workspaces_root = tmp_path / "workspaces"
    workspace = workspaces_root / "athlete"
    monkeypatch.setattr("personal_trainer.cli.WORKSPACES_ROOT", workspaces_root)
    monkeypatch.setenv("PYTEST_CURRENT_TEST", "trainer/tests/test_cli_flow.py::test")
    monkeypatch.setenv("LANGFUSE_PUBLIC_KEY", "public-test-key")
    monkeypatch.setenv("LANGFUSE_SECRET_KEY", "secret-test-key")
    monkeypatch.setenv("LANGFUSE_HOST", "https://cloud.langfuse.com")
    _install_stub_ollama(monkeypatch, day_count=3)
    runner = CliRunner()

    assert runner.invoke(main, ["init", "athlete"]).exit_code == 0
    result = runner.invoke(main, ["plan", "athlete"])

    assert result.exit_code == 0
    assert (workspace / "plan.md").exists()
    llm_log_path = workspace / ".trainer" / "logs" / "llm_calls.jsonl"
    assert llm_log_path.exists()
    records = [
        json.loads(line)
        for line in llm_log_path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    assert len(records) == 3
    assert all(record["success"] is True for record in records)
    assert all(record["session_id"] for record in records)


def test_plan_honors_session_id_override(tmp_path, monkeypatch) -> None:
    workspaces_root = tmp_path / "workspaces"
    workspace = workspaces_root / "athlete"
    monkeypatch.setattr("personal_trainer.cli.WORKSPACES_ROOT", workspaces_root)
    _install_stub_ollama(monkeypatch, day_count=3)
    runner = CliRunner()

    assert runner.invoke(main, ["init", "athlete"]).exit_code == 0
    result = runner.invoke(main, ["plan", "athlete", "--session-id", "conversation-42"])

    assert result.exit_code == 0
    llm_log_path = workspace / ".trainer" / "logs" / "llm_calls.jsonl"
    records = [
        json.loads(line)
        for line in llm_log_path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    assert len(records) == 3
    assert all(record["session_id"] == "conversation-42" for record in records)


def test_plan_honors_max_review_iterations_override(tmp_path, monkeypatch) -> None:
    workspaces_root = tmp_path / "workspaces"
    workspace = workspaces_root / "athlete"
    monkeypatch.setattr("personal_trainer.cli.WORKSPACES_ROOT", workspaces_root)
    _install_stub_ollama(monkeypatch, day_count=3, review_approved=False)
    runner = CliRunner()

    assert runner.invoke(main, ["init", "athlete"]).exit_code == 0
    result = runner.invoke(
        main,
        ["plan", "athlete", "--max-review-iterations", "2"],
    )

    assert result.exit_code == 0
    assert "Warning: review loop hit max iterations" in result.output

    review_payload = json.loads((workspace / "plan_review.json").read_text(encoding="utf-8"))
    assert review_payload["final_status"] == "max_iterations_reached"
    assert review_payload["iterations_ran"] == 2

    llm_log_path = workspace / ".trainer" / "logs" / "llm_calls.jsonl"
    records = [
        json.loads(line)
        for line in llm_log_path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    assert len(records) == 6
    step_names = [record["step_name"] for record in records]
    assert "planner_revision_iter_1" in step_names


def test_status_runs(tmp_path, monkeypatch) -> None:
    workspaces_root = tmp_path / "workspaces"
    workspace = workspaces_root / "athlete"
    monkeypatch.setattr("personal_trainer.cli.WORKSPACES_ROOT", workspaces_root)
    runner = CliRunner()

    assert runner.invoke(main, ["init", "athlete"]).exit_code == 0
    result = runner.invoke(main, ["status", "athlete"])
    assert result.exit_code == 0
    assert "Profile exists: yes" in result.output


def test_publish_web_command_reports_upload_summary(tmp_path, monkeypatch) -> None:
    workspaces_root = tmp_path / "workspaces"
    workspace = workspaces_root / "athlete"
    workspace.mkdir(parents=True)
    monkeypatch.setattr("personal_trainer.cli.WORKSPACES_ROOT", workspaces_root)
    monkeypatch.setattr(
        "personal_trainer.cli.publish_workspace_to_blob",
        lambda *args, **kwargs: BlobPublishResult(
            workspace="athlete",
            prefix="pt-prod",
            access="private",
            workspace_files_uploaded=4,
            remote_files_deleted=3,
        ),
    )
    runner = CliRunner()

    result = runner.invoke(main, ["publish-web", "athlete", "--prefix", "pt-prod"])

    assert result.exit_code == 0
    assert "Published workspace 'athlete' to Blob prefix 'pt-prod'" in result.output
    assert "Workspace files uploaded: 4" in result.output


@pytest.mark.paid_openai
def test_plan_loads_openai_api_key_from_dotenv_local(tmp_path, monkeypatch) -> None:
    workspaces_root = tmp_path / "workspaces"
    workspace = workspaces_root / "athlete"
    monkeypatch.setattr("personal_trainer.cli.WORKSPACES_ROOT", workspaces_root)
    monkeypatch.chdir(tmp_path)
    (tmp_path / ".env.local").write_text("OPENAI_API_KEY=dotenv-key\n", encoding="utf-8")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    _install_stub_openai(monkeypatch, day_count=3)
    runner = CliRunner()

    assert runner.invoke(main, ["init", "athlete"]).exit_code == 0
    result = runner.invoke(main, ["plan", "athlete", "--openai-model", "gpt-5.4-mini"])

    assert result.exit_code == 0
    assert (workspace / "plan.md").exists()
    assert "Generated by: openai/gpt-5.4-mini" in (workspace / "plan.md").read_text(
        encoding="utf-8"
    )


@pytest.mark.paid_openai
def test_process_env_openai_key_takes_priority_over_dotenv(tmp_path, monkeypatch) -> None:
    workspaces_root = tmp_path / "workspaces"
    workspace = workspaces_root / "athlete"
    monkeypatch.setattr("personal_trainer.cli.WORKSPACES_ROOT", workspaces_root)
    monkeypatch.chdir(tmp_path)
    (tmp_path / ".env.local").write_text(
        "OPENAI_API_KEY=dotenv-key\n",
        encoding="utf-8",
    )
    monkeypatch.setenv("OPENAI_API_KEY", "process-key")
    captured_api_keys: list[str] = []

    def fake_chat_json(self, *, system_prompt, user_prompt, schema):
        captured_api_keys.append(self.config.api_key)
        if _is_review_schema(schema):
            return _stub_review_payload(True)
        payload = _stub_plan_payload(3)
        payload["summary"] = f"OpenAI plan for {self.config.model}"
        return payload

    monkeypatch.setattr(
        "personal_trainer.openai_client.OpenAIChatClient.chat_json",
        fake_chat_json,
    )
    runner = CliRunner()

    assert runner.invoke(main, ["init", "athlete"]).exit_code == 0
    result = runner.invoke(main, ["plan", "athlete", "--openai-model", "gpt-5.4-mini"])

    assert result.exit_code == 0
    assert set(captured_api_keys) == {"process-key"}
    assert len(captured_api_keys) == 3
    assert (workspace / "plan.md").exists()
