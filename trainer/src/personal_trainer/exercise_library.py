from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from importlib.resources import as_file, files
from pathlib import Path

@dataclass(frozen=True, slots=True)
class ExerciseReference:
    slug: str
    name: str
    aliases: tuple[str, ...]
    summary: str
    setup: str
    cues: tuple[str, ...]
    visual_note: str
    image_url: str
    source_title: str
    source_url: str
    author: str
    credit: str
    license: str
    license_url: str

    @property
    def image_path(self) -> str:
        return self.image_url


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
            image_url=item.get("image_url", ""),
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
