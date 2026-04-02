from __future__ import annotations

from pathlib import Path

from click.testing import CliRunner

from personal_trainer.cli import main
from personal_trainer.notes_publisher import build_notes_document, default_note_title


def _install_stub_ollama(monkeypatch) -> None:
    def fake_chat_json(self, *, system_prompt, user_prompt, schema):
        return {
            "summary": "Plan summary",
            "progression_note": "Progress slowly",
            "next_checkin_prompt": "Complete a check-in at the end of the week.",
            "days": [
                {
                    "day_label": "Day 1",
                    "focus": "Lower",
                    "warmup": "5 minutes easy cardio",
                    "exercises": [
                        {
                            "name": "Goblet Squat",
                            "prescription": "3 sets x 8-12 reps",
                            "notes": "Stay tall.",
                        }
                    ],
                    "finisher": "5 minute bike",
                    "recovery": "Walk and hydrate",
                }
            ],
        }

    monkeypatch.setattr(
        "personal_trainer.ollama_client.OllamaChatClient.chat_json",
        fake_chat_json,
    )


def test_build_notes_document_skips_images(tmp_path: Path) -> None:
    workspace = tmp_path / "workspace"
    (workspace / "exercise_library").mkdir(parents=True)

    plan_markdown = """# Albert's Training Plan

## Day 1: Lower
- **Goblet Squat**: 3 sets x 8-12. Stay tall.
  <img src="https://wger.de/media/exercise-images/1542/dumbbell-goblet-squat.jpeg" alt="Goblet Squat" width="240" />
  Reference: [Goblet Squat](exercise_library/goblet-squat.md)
"""

    document = build_notes_document(plan_markdown, workspace)

    assert "<b>Albert&#x27;s Training Plan</b>" in document.html_body
    assert (
        "<li><b>Goblet Squat</b>: 3 sets x 8-12. Stay tall.</li>" in document.html_body
    )
    assert "Exercise Images" not in document.html_body


def test_default_note_title_uses_profile_name(tmp_path: Path) -> None:
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    (workspace / "profile.md").write_text(
        """# Athlete Profile

## Basics
- Name: Jordan

## Goals
- Primary goal: Get stronger
- Experience level: beginner
- Cardio preference: walk

## Schedule
- Days per week: 3
- Session length minutes: 45

## Equipment
- Dumbbells

## Limitations
- 

## Preferred Focus
- Strength

## Notes
- 
""",
        encoding="utf-8",
    )

    assert default_note_title(workspace) == "Current Workout - Jordan"


def test_publish_notes_command_calls_publisher(tmp_path: Path, monkeypatch) -> None:
    workspaces_root = tmp_path / "workspaces"
    workspace = workspaces_root / "workspace"
    monkeypatch.setattr("personal_trainer.cli.WORKSPACES_ROOT", workspaces_root)
    _install_stub_ollama(monkeypatch)
    runner = CliRunner()

    assert runner.invoke(main, ["init", "workspace"]).exit_code == 0
    assert runner.invoke(main, ["plan", "workspace"]).exit_code == 0

    captured: dict[str, str] = {}

    class StubResult:
        account = "iCloud"
        folder = "Personal Trainer"
        title = "Current Workout - Albert"
        note_id = "note-123"

    def fake_publish_plan_to_notes(workspace_path, *, account, folder, title):
        captured["workspace"] = str(workspace_path)
        captured["account"] = account
        captured["folder"] = folder
        captured["title"] = title or ""
        return StubResult()

    monkeypatch.setattr(
        "personal_trainer.cli.publish_plan_to_notes", fake_publish_plan_to_notes
    )

    result = runner.invoke(main, ["publish-notes", "workspace"])

    assert result.exit_code == 0
    assert captured["workspace"] == str(workspace.resolve())
    assert captured["account"] == "iCloud"
    assert captured["folder"] == "Personal Trainer"
    assert "Published 'Current Workout - Albert' to Apple Notes" in result.output
