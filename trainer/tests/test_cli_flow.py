from __future__ import annotations

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
                "exercises": [
                    {
                        "name": "Dumbbell Bench Press",
                        "prescription": "3 sets x 8-10 reps",
                        "notes": "Stop with 1-2 reps in reserve.",
                    },
                    {
                        "name": "1-Arm Dumbbell Row",
                        "prescription": "3 sets x 8-10 reps",
                        "notes": "Control the lowering phase.",
                    },
                ],
                "finisher": "8 minutes on the bike at a conversational pace.",
                "recovery": "Monitor symptoms and keep the next day easy if needed.",
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


def _install_stub_ollama(monkeypatch, *, day_count: int = 3) -> None:
    def fake_chat_json(self, *, system_prompt, user_prompt, schema):
        payload = _stub_plan_payload(day_count)
        payload["summary"] = f"Ollama plan for {self.config.model}"
        return payload

    monkeypatch.setattr(
        "personal_trainer.ollama_client.OllamaChatClient.chat_json",
        fake_chat_json,
    )


def _install_stub_openai(monkeypatch, *, day_count: int = 3) -> None:
    def fake_chat_json(self, *, system_prompt, user_prompt, schema):
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
    assert (workspace / "exercise_library" / "index.md").exists()

    profile = (workspace / "profile.md").read_text(encoding="utf-8")
    profile = profile.replace("Albert", "Jordan").replace(
        "Days per week: 4", "Days per week: 3"
    )
    (workspace / "profile.md").write_text(profile, encoding="utf-8")

    result = runner.invoke(main, ["plan", "athlete"])
    assert result.exit_code == 0
    assert (workspace / "plan.md").exists()
    assert (workspace / "plan.json").exists()
    assert (workspace / "coach_notes.md").exists()

    assert "Plan written" in result.output
    assert "coach_notes.md" in result.output
    plan_text = (workspace / "plan.md").read_text(encoding="utf-8")
    plan_json = (workspace / "plan.json").read_text(encoding="utf-8")
    assert "exercise_library/images/" in plan_text
    assert "Reference: [Dumbbell Bench Press]" in plan_text
    assert '"days": [' in plan_json
    assert (
        '"imagePath": "exercise_library/images/dumbbell-bench-press.png"' in plan_json
    )


def test_refresh_updates_state(tmp_path, monkeypatch) -> None:
    workspaces_root = tmp_path / "workspaces"
    workspace = workspaces_root / "athlete"
    monkeypatch.setattr("personal_trainer.cli.WORKSPACES_ROOT", workspaces_root)
    _install_stub_ollama(monkeypatch, day_count=3)
    runner = CliRunner()

    assert runner.invoke(main, ["init", "athlete"]).exit_code == 0
    assert runner.invoke(main, ["plan", "athlete"]).exit_code == 0

    checkin = workspace / "checkins" / "2026-03-30-checkin.md"
    checkin.write_text(
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

    result = runner.invoke(main, ["refresh", "athlete", checkin.name])
    assert result.exit_code == 0
    state = load_state(workspace / ".trainer" / "state.json")

    assert state.plan_version == 2
    assert state.generated_plans == 2
    assert state.last_check_in == "2026-03-30"
    assert "Plan version: 2" in (workspace / "plan.md").read_text(encoding="utf-8")
    assert '"value": "2"' in (workspace / "plan.json").read_text(encoding="utf-8")
    assert (workspace / "exercise_library" / "goblet-squat.md").exists()


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
    openai_plan = workspace / "plan-openai-gpt-5-4-mini.md"
    openai_plan_json = workspace / "plan-openai-gpt-5-4-mini.json"

    assert ollama_plan.exists()
    assert ollama_plan_json.exists()
    assert openai_plan.exists()
    assert openai_plan_json.exists()
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
            library_files_uploaded=2,
            remote_files_deleted=3,
        ),
    )
    runner = CliRunner()

    result = runner.invoke(main, ["publish-web", "athlete", "--prefix", "pt-prod"])

    assert result.exit_code == 0
    assert "Published workspace 'athlete' to Blob prefix 'pt-prod'" in result.output
    assert "Workspace files uploaded: 4" in result.output
    assert "Library files uploaded: 2" in result.output


def test_recipes_command_suggests_goal_aligned_meals(tmp_path, monkeypatch) -> None:
    workspaces_root = tmp_path / "workspaces"
    workspace = workspaces_root / "athlete"
    monkeypatch.setattr("personal_trainer.cli.WORKSPACES_ROOT", workspaces_root)
    runner = CliRunner()

    assert runner.invoke(main, ["init", "athlete"]).exit_code == 0

    profile = (workspace / "profile.md").read_text(encoding="utf-8")
    profile = profile.replace("Build muscle and improve conditioning", "Build muscle")
    (workspace / "profile.md").write_text(profile, encoding="utf-8")

    result = runner.invoke(
        main,
        ["recipes", "athlete", "--ingredients", "chicken, rice, broccoli, garlic"],
    )

    assert result.exit_code == 0
    assert "Recipe suggestions for athlete" in result.output
    assert "Chicken, Rice, and Broccoli Bowl" in result.output
    assert "[strong fit]" in result.output
