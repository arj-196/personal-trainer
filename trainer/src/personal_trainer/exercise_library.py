from __future__ import annotations

import json
import shutil
from dataclasses import dataclass
from functools import lru_cache
from importlib.resources import as_file, files
from pathlib import Path

IMAGE_WIDTH_PX = 240


@dataclass(frozen=True, slots=True)
class ExerciseReference:
    slug: str
    name: str
    aliases: tuple[str, ...]
    summary: str
    setup: str
    cues: tuple[str, ...]
    visual_note: str
    image_filename: str
    source_title: str
    source_url: str
    author: str
    credit: str
    license: str
    license_url: str

    @property
    def image_path(self) -> str:
        return f"exercise_library/images/{self.image_filename}"

    @property
    def markdown_path(self) -> str:
        return f"exercise_library/{self.slug}.md"

    @property
    def local_image_path(self) -> str:
        return f"images/{self.image_filename}"


@lru_cache(maxsize=1)
def _catalog() -> tuple[ExerciseReference, ...]:
    resource = files("personal_trainer").joinpath(
        "assets/exercise_library/catalog.json"
    )
    with as_file(resource) as catalog_path:
        raw_catalog = json.loads(Path(catalog_path).read_text(encoding="utf-8"))
    return tuple(
        ExerciseReference(
            slug=item["slug"],
            name=item["name"],
            aliases=tuple(item["aliases"]),
            summary=item["summary"],
            setup=item["setup"],
            cues=tuple(item["cues"]),
            visual_note=item.get("visual_note", ""),
            image_filename=item["image_filename"],
            source_title=item["source_title"],
            source_url=item["source_url"],
            author=item.get("author", ""),
            credit=item.get("credit", ""),
            license=item.get("license", ""),
            license_url=item.get("license_url", ""),
        )
        for item in raw_catalog
    )


@lru_cache(maxsize=1)
def _reference_map() -> dict[str, ExerciseReference]:
    mapping: dict[str, ExerciseReference] = {}
    for reference in _catalog():
        for alias in (reference.name, *reference.aliases):
            mapping[_normalize(alias)] = reference
    return mapping


def _normalize(value: str) -> str:
    return " ".join(value.strip().lower().replace("_", " ").split())


def get_reference(exercise_name: str) -> ExerciseReference | None:
    return _reference_map().get(_normalize(exercise_name))


def all_references() -> tuple[ExerciseReference, ...]:
    return _catalog()


def sync_workspace_library(workspace_root: Path) -> None:
    library_dir = workspace_root / "exercise_library"
    image_dir = library_dir / "images"
    library_dir.mkdir(parents=True, exist_ok=True)
    image_dir.mkdir(parents=True, exist_ok=True)

    for reference in _catalog():
        source_resource = files("personal_trainer").joinpath(
            f"assets/exercise_library/images/{reference.image_filename}"
        )
        with as_file(source_resource) as source:
            target = image_dir / reference.image_filename
            if not target.exists() or source.stat().st_mtime > target.stat().st_mtime:
                shutil.copyfile(source, target)

    for reference in _catalog():
        (library_dir / f"{reference.slug}.md").write_text(
            _render_reference(reference), encoding="utf-8"
        )
    (library_dir / "index.md").write_text(_render_index(), encoding="utf-8")


def _render_reference(reference: ExerciseReference) -> str:
    lines = [
        f"# {reference.name}",
        "",
        _render_image(reference.name, reference.local_image_path),
        "",
        "## What It Is",
        reference.summary,
        "",
        "## Setup",
        reference.setup,
        "",
        "## Coaching Cues",
    ]
    lines.extend(f"- {cue}" for cue in reference.cues)
    if reference.visual_note:
        lines.extend(["", "## Visual Note", reference.visual_note])
    lines.extend(
        [
            "",
            "## Attribution",
            f"- Source file: {reference.source_title}",
            f"- Source page: {reference.source_url}",
            f"- Author: {reference.author or 'Not provided'}",
            f"- Credit: {reference.credit or 'Not provided'}",
            f"- License: {reference.license or 'See source page'}",
        ]
    )
    if reference.license_url:
        lines.append(f"- License URL: {reference.license_url}")
    lines.append("")
    return "\n".join(lines)


def _render_index() -> str:
    lines = [
        "# Exercise Library",
        "",
        "Use these reference pages when you want a quick explanation and picture for an exercise in your plan.",
        "",
    ]
    for reference in _catalog():
        lines.extend(
            [
                f"## {reference.name}",
                _render_image(reference.name, reference.local_image_path),
                reference.summary,
                f"Reference: [{reference.name}]({reference.slug}.md)",
                "",
            ]
        )
    return "\n".join(lines)


def _render_image(alt_text: str, path: str) -> str:
    return f'<img src="{path}" alt="{alt_text}" width="{IMAGE_WIDTH_PX}" />'
