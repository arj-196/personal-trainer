from __future__ import annotations

import html
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path

from personal_trainer.markdown_io import load_profile, workspace_paths

IMAGE_PATTERN = re.compile(r"!\[(?P<alt>.*?)\]\((?P<path>.+?)\)")
HTML_IMAGE_PATTERN = re.compile(r"^\s*<img\s+[^>]*src=\"(?P<path>[^\"]+)\"[^>]*>\s*$")
BOLD_PATTERN = re.compile(r"\*\*(.+?)\*\*")
REFERENCE_LINE = re.compile(r"^\s*Reference:\s+")


@dataclass(frozen=True, slots=True)
class NotesDocument:
    html_body: str


@dataclass(frozen=True, slots=True)
class NotesPublishResult:
    account: str
    folder: str
    title: str
    note_id: str


class NotesPublishError(RuntimeError):
    """Raised when publishing to Apple Notes fails."""


def publish_plan_to_notes(
    workspace: Path,
    *,
    account: str = "iCloud",
    folder: str = "Personal Trainer",
    title: str | None = None,
) -> NotesPublishResult:
    paths = workspace_paths(workspace)
    if not paths.plan.exists():
        raise NotesPublishError(f"Missing plan: {paths.plan}")

    note_title = title or default_note_title(workspace)
    document = build_notes_document(paths.plan.read_text(encoding="utf-8"), workspace)
    note_id = _create_note(
        account=account, folder=folder, title=note_title, html_body=document.html_body
    )

    _show_note(note_id)
    return NotesPublishResult(
        account=account, folder=folder, title=note_title, note_id=note_id
    )


def default_note_title(workspace: Path) -> str:
    paths = workspace_paths(workspace)
    if paths.profile.exists():
        profile = load_profile(paths.profile)
        return f"Current Workout - {profile.name}"
    if paths.plan.exists():
        first_line = paths.plan.read_text(encoding="utf-8").splitlines()[0].strip()
        if first_line.startswith("# "):
            return f"Current Workout - {first_line[2:]}"
    return "Current Workout"


def build_notes_document(plan_markdown: str, workspace: Path) -> NotesDocument:
    html_parts: list[str] = []
    in_list = False

    def close_list() -> None:
        nonlocal in_list
        if in_list:
            html_parts.append("</ul>")
            in_list = False

    for raw_line in plan_markdown.splitlines():
        stripped = raw_line.strip()

        if not stripped:
            close_list()
            html_parts.append("<div><br></div>")
            continue

        image_match = IMAGE_PATTERN.fullmatch(stripped)
        if image_match:
            continue
        html_image_match = HTML_IMAGE_PATTERN.fullmatch(stripped)
        if html_image_match:
            continue

        if REFERENCE_LINE.match(stripped):
            continue

        if stripped.startswith("# "):
            close_list()
            html_parts.append(f"<div><b>{html.escape(stripped[2:])}</b></div>")
            continue

        if stripped.startswith("## "):
            close_list()
            html_parts.append("<div><br></div>")
            html_parts.append(f"<div><b>{html.escape(stripped[3:])}</b></div>")
            continue

        if stripped.startswith("- "):
            if not in_list:
                html_parts.append("<ul>")
                in_list = True
            html_parts.append(f"<li>{_format_inline(stripped[2:])}</li>")
            continue

        close_list()
        html_parts.append(f"<div>{_format_inline(stripped)}</div>")

    close_list()

    return NotesDocument(html_body="".join(html_parts))


def _format_inline(value: str) -> str:
    escaped = html.escape(value)
    return BOLD_PATTERN.sub(r"<b>\1</b>", escaped)


def _run_osascript(script: str, *args: str) -> str:
    result = subprocess.run(
        ["osascript", "-", *args], input=script, text=True, capture_output=True
    )
    if result.returncode != 0:
        raise NotesPublishError(result.stderr.strip() or "Apple Notes publish failed.")
    return result.stdout.strip()


def _create_note(*, account: str, folder: str, title: str, html_body: str) -> str:
    script = """
on run argv
    set accountName to item 1 of argv
    set folderName to item 2 of argv
    set noteTitle to item 3 of argv
    set noteHtml to item 4 of argv
    tell application "Notes"
        if not (exists account accountName) then error "Notes account not found: " & accountName
        tell account accountName
            if not (exists folder folderName) then
                make new folder with properties {name:folderName}
            end if
            tell folder folderName
                set existingNotes to every note whose name is noteTitle
                repeat with existingNote in existingNotes
                    delete existingNote
                end repeat
                set newNote to make new note with properties {name:noteTitle, body:noteHtml}
                return id of newNote
            end tell
        end tell
    end tell
end run
"""
    return _run_osascript(script, account, folder, title, html_body)


def _show_note(note_id: str) -> None:
    script = """
on run argv
    set noteId to item 1 of argv
    tell application "Notes"
        set theNote to first note whose id is noteId
        show theNote
    end tell
end run
"""
    _run_osascript(script, note_id)
