from __future__ import annotations

from pathlib import Path

from click.testing import CliRunner

from personal_trainer.cli import main
from personal_trainer.notes_publisher import build_notes_document, default_note_title


def test_build_notes_document_skips_images(tmp_path: Path) -> None:
    workspace = tmp_path / "workspace"
    image_dir = workspace / "exercise_library" / "images"
    image_dir.mkdir(parents=True)
    (image_dir / "goblet-squat.png").write_bytes(b"fake-image")

    plan_markdown = """# Albert's Training Plan

## Day 1: Lower
- **Goblet Squat**: 3 sets x 8-12. Stay tall.
  ![Goblet Squat](exercise_library/images/goblet-squat.png)
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
