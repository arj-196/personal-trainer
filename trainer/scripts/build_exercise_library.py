from __future__ import annotations

"""Build the bundled exercise library from a wger dump.

The script reads a wger exercise JSON dump, converts each included exercise into
the trainer's catalog schema, and rewrites `catalog.json` with wger-backed image
URLs instead of downloading local exercise assets.
"""

import json
import logging
import re
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import click

ASSET_ROOT = (
    Path(__file__).resolve().parents[1]
    / "src"
    / "personal_trainer"
    / "assets"
    / "exercise_library"
)
CATALOG_PATH = ASSET_ROOT / "catalog.json"
DEFAULT_INPUT_PATH = Path(__file__).resolve().parents[2] / "zsnippets" / "wger_exercise_catalog.json"
LOGGER = logging.getLogger(__name__)


def configure_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | %(message)s",
        force=True,
    )


def convert_catalog_payload(
    payload: dict[str, Any], *, include_without_images: bool = False
) -> list[dict[str, Any]]:
    exercises = payload.get("exercises")
    if not isinstance(exercises, list):
        raise ValueError("Expected payload.exercises to be a list")

    prepared: list[dict[str, Any]] = []
    seen_slugs: set[str] = set()
    skipped_without_images = 0
    duplicate_slugs = 0

    for raw_exercise in exercises:
        if not isinstance(raw_exercise, dict):
            LOGGER.warning("Skipping non-object exercise payload: %r", raw_exercise)
            continue

        prepared_exercise = convert_exercise(raw_exercise)
        if not include_without_images and not prepared_exercise["image_url"]:
            skipped_without_images += 1
            continue

        slug = prepared_exercise["slug"]
        if slug in seen_slugs:
            duplicate_slugs += 1
            deduped_slug = dedupe_slug(slug, raw_exercise)
            prepared_exercise["slug"] = deduped_slug

        seen_slugs.add(prepared_exercise["slug"])
        prepared.append(prepared_exercise)

    prepared.sort(key=lambda item: item["name"].lower())
    LOGGER.info(
        "Prepared %s exercises from wger payload (%s skipped without images, %s duplicate slugs resolved)",
        len(prepared),
        skipped_without_images,
        duplicate_slugs,
    )
    return prepared


def convert_exercise(raw_exercise: dict[str, Any]) -> dict[str, Any]:
    translation = select_english_translation(raw_exercise)
    name = clean_text(translation.get("name")) or clean_text(raw_exercise.get("name"))
    if not name:
        raise ValueError(f"Exercise {raw_exercise.get('id')} is missing a usable name")

    description = (
        clean_text(translation.get("description_text"))
        or clean_text(raw_exercise.get("description_text"))
        or ""
    )
    steps = split_description_steps(description)
    setup = build_setup(steps) or fallback_setup(raw_exercise)
    cues = build_cues(steps) or fallback_cues(raw_exercise)

    image_url = main_image_url(raw_exercise)

    return {
        "slug": slugify(name),
        "name": name,
        "aliases": build_aliases(raw_exercise, translation, canonical_name=name),
        "summary": build_summary(raw_exercise, description),
        "setup": setup,
        "cues": cues,
        "visual_note": "",
        "image_url": image_url,
        "source_title": f"wger exercise {raw_exercise.get('id')}",
        "source_url": image_url or build_exercise_url(raw_exercise),
        "author": build_author(raw_exercise),
        "credit": "wger",
        "license": clean_text(raw_exercise.get("license", {}).get("short_name")),
        "license_url": clean_text(raw_exercise.get("license", {}).get("url")),
    }


def select_english_translation(raw_exercise: dict[str, Any]) -> dict[str, Any]:
    for translation in raw_exercise.get("translations", []):
        language = translation.get("language", {})
        if language.get("code") == "en":
            return translation
    return {}


def build_aliases(
    raw_exercise: dict[str, Any],
    translation: dict[str, Any],
    *,
    canonical_name: str,
) -> list[str]:
    candidates = [canonical_name]
    candidates.extend(translation.get("aliases", []))
    candidates.append(raw_exercise.get("name"))

    aliases: list[str] = []
    seen_normalized: set[str] = set()
    for value in candidates:
        text = clean_text(value)
        if not text:
            continue
        normalized = normalize_name(text)
        if normalized in seen_normalized:
            continue
        seen_normalized.add(normalized)
        aliases.append(text)
    return aliases


def build_summary(raw_exercise: dict[str, Any], description: str) -> str:
    sentence = first_sentence(description)
    if sentence:
        return sentence

    category = clean_text(raw_exercise.get("category", {}).get("name"))
    muscles = primary_muscle_names(raw_exercise)
    muscle_text = ", ".join(muscles[:3])
    if category and muscle_text:
        return f"A {category.lower()} exercise that primarily targets {muscle_text}."
    if category:
        return f"A {category.lower()} exercise."
    if muscle_text:
        return f"An exercise that primarily targets {muscle_text}."
    return "An exercise imported from the wger catalog."


def build_setup(steps: list[str]) -> str:
    return steps[0] if steps else ""


def build_cues(steps: list[str]) -> list[str]:
    return [step for step in steps[1:4] if step]


def fallback_setup(raw_exercise: dict[str, Any]) -> str:
    equipment = [
        clean_text(item.get("name"))
        for item in raw_exercise.get("equipment", [])
        if isinstance(item, dict)
    ]
    equipment = [item for item in equipment if item]
    if equipment:
        return f"Set up with {', '.join(equipment[:2])} before starting the movement."
    category = clean_text(raw_exercise.get("category", {}).get("name"))
    if category:
        return f"Prepare for this {category.lower()} movement with a controlled starting position."
    return "Set up in a controlled starting position before beginning the exercise."


def fallback_cues(raw_exercise: dict[str, Any]) -> list[str]:
    muscles = primary_muscle_names(raw_exercise)
    cues = [
        "Move under control and keep the working position consistent from rep to rep.",
    ]
    if muscles:
        cues.append(f"Focus on the target area: {', '.join(muscles[:3])}.")
    cues.append("Stop the set when technique starts to break down.")
    return cues[:3]


def split_description_steps(description: str) -> list[str]:
    if not description:
        return []

    normalized = description.replace("\r\n", "\n")
    normalized = re.sub(r"<[^>]+>", " ", normalized)
    normalized = normalized.replace("&nbsp;", " ")
    parts = re.split(r"(?:\n\s*\n+|\n[-*]\s+|\n?\d+\.\s+)", normalized)
    steps: list[str] = []
    for part in parts:
        cleaned = clean_text(part)
        if not cleaned:
            continue
        cleaned = re.sub(r"^[-*]\s*", "", cleaned)
        if cleaned:
            steps.append(cleaned)
    if len(steps) <= 1:
        sentence_steps = split_into_sentences(normalized)
        if sentence_steps:
            return sentence_steps
    return steps


def split_into_sentences(value: str) -> list[str]:
    text = clean_text(value)
    if not text:
        return []
    raw_parts = re.split(r"(?<=[.!?])\s+", text)
    parts: list[str] = []
    for part in raw_parts:
        cleaned = re.sub(r"^[-*]\s*", "", clean_text(part))
        if cleaned:
            parts.append(cleaned)
    return parts


def first_sentence(description: str) -> str:
    text = clean_text(description)
    if not text:
        return ""
    text = re.sub(r"^[-*]\s*", "", text)
    match = re.match(r"(.+?[.!?])(?:\s|$)", text)
    return match.group(1) if match else text


def primary_muscle_names(raw_exercise: dict[str, Any]) -> list[str]:
    names: list[str] = []
    seen: set[str] = set()
    for muscle in raw_exercise.get("muscles_primary", []):
        if not isinstance(muscle, dict):
            continue
        text = clean_text(muscle.get("name_en")) or clean_text(muscle.get("name"))
        if not text:
            continue
        key = text.lower()
        if key in seen:
            continue
        seen.add(key)
        names.append(text)
    return names


def main_image_url(raw_exercise: dict[str, Any]) -> str:
    images = raw_exercise.get("images", [])
    if not isinstance(images, list):
        return ""

    for image in images:
        if isinstance(image, dict) and image.get("is_main"):
            return clean_text(image.get("url"))
    for image in images:
        if isinstance(image, dict):
            url = clean_text(image.get("url"))
            if url:
                return url
    return ""


def build_author(raw_exercise: dict[str, Any]) -> str:
    images = raw_exercise.get("images", [])
    for image in images:
        if not isinstance(image, dict):
            continue
        license_data = image.get("license", {})
        author = clean_text(license_data.get("author"))
        if author:
            return author
    return clean_text(raw_exercise.get("license_author"))


def build_exercise_url(raw_exercise: dict[str, Any]) -> str:
    identifier = raw_exercise.get("id")
    return f"https://wger.de/en/exercise/{identifier}/view/" if identifier else ""


def dedupe_slug(base_slug: str, raw_exercise: dict[str, Any]) -> str:
    identifier = raw_exercise.get("id")
    if identifier is not None:
        return f"{base_slug}-{identifier}"
    return f"{base_slug}-{raw_exercise.get('uuid', 'duplicate')}"


def slugify(value: str) -> str:
    lowered = normalize_name(value)
    lowered = re.sub(r"[^a-z0-9]+", "-", lowered)
    lowered = re.sub(r"-{2,}", "-", lowered).strip("-")
    return lowered or "exercise"


def normalize_name(value: str) -> str:
    return " ".join(value.strip().lower().split())


def clean_text(value: Any) -> str:
    if not isinstance(value, str):
        return ""
    return " ".join(value.replace("\xa0", " ").split())


def write_catalog(prepared_exercises: list[dict[str, Any]], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(prepared_exercises, indent=2) + "\n", encoding="utf-8"
    )
    LOGGER.info("Wrote %s catalog entries to %s", len(prepared_exercises), output_path)


def build_library(
    input_path: Path,
    *,
    output_path: Path,
    include_without_images: bool = False,
) -> None:
    payload = json.loads(input_path.read_text(encoding="utf-8"))
    prepared = convert_catalog_payload(
        payload, include_without_images=include_without_images
    )
    write_catalog(prepared, output_path)


@click.command(help="Build the bundled exercise library from a wger dump.")
@click.argument(
    "input_path",
    required=False,
    type=click.Path(exists=True, dir_okay=False, path_type=Path),
    default=DEFAULT_INPUT_PATH,
)
@click.option(
    "--output-path",
    type=click.Path(dir_okay=False, path_type=Path),
    default=CATALOG_PATH,
    show_default=True,
    help="Catalog JSON output path.",
)
@click.option(
    "--include-without-images",
    is_flag=True,
    help="Include exercises even when the dump has no image URL for them.",
)
def main(
    input_path: Path,
    output_path: Path,
    include_without_images: bool,
) -> None:
    configure_logging()
    build_library(
        input_path,
        output_path=output_path,
        include_without_images=include_without_images,
    )


if __name__ == "__main__":
    main()
