from __future__ import annotations

import json
import re
from dataclasses import dataclass
from difflib import SequenceMatcher
from functools import lru_cache
from importlib.resources import as_file, files
from pathlib import Path


FUZZY_MATCH_MIN_SCORE = 0.92
FUZZY_MATCH_MIN_MARGIN = 0.04


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


@dataclass(frozen=True, slots=True)
class ExerciseNameMatch:
    reference: ExerciseReference
    matched_alias: str
    score: float
    strategy: str


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


def _normalize_for_fuzzy(value: str) -> str:
    base = _normalize(value)
    cleaned = re.sub(r"[^a-z0-9 ]+", " ", base)
    return " ".join(cleaned.split())


@lru_cache(maxsize=1)
def _fuzzy_alias_entries() -> tuple[tuple[str, ExerciseReference, str], ...]:
    entries: list[tuple[str, ExerciseReference, str]] = []
    for reference in _catalog():
        for alias in (reference.name, *reference.aliases):
            normalized_alias = _normalize_for_fuzzy(alias)
            if not normalized_alias:
                continue
            entries.append((normalized_alias, reference, alias))
    return tuple(entries)


def get_reference(exercise_name: str) -> ExerciseReference | None:
    return _reference_map().get(_normalize(exercise_name))


def resolve_reference(exercise_name: str) -> ExerciseNameMatch | None:
    normalized = _normalize(exercise_name)
    if not normalized:
        return None

    exact = _reference_map().get(normalized)
    if exact is not None:
        return ExerciseNameMatch(
            reference=exact,
            matched_alias=exercise_name,
            score=1.0,
            strategy="exact",
        )

    fuzzy_name = _normalize_for_fuzzy(exercise_name)
    if not fuzzy_name:
        return None

    best_match: ExerciseNameMatch | None = None
    second_best_score = 0.0
    for normalized_alias, reference, alias in _fuzzy_alias_entries():
        score = SequenceMatcher(None, fuzzy_name, normalized_alias).ratio()
        if best_match is None or score > best_match.score:
            if best_match is not None:
                second_best_score = max(second_best_score, best_match.score)
            best_match = ExerciseNameMatch(
                reference=reference,
                matched_alias=alias,
                score=score,
                strategy="fuzzy",
            )
        else:
            second_best_score = max(second_best_score, score)

    if best_match is None:
        return None
    if best_match.score < FUZZY_MATCH_MIN_SCORE:
        return None
    if best_match.score - second_best_score < FUZZY_MATCH_MIN_MARGIN:
        return None
    return best_match


def all_references() -> tuple[ExerciseReference, ...]:
    return _catalog()
