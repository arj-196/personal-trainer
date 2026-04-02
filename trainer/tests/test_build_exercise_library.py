from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1] / "scripts" / "build_exercise_library.py"
)
SPEC = importlib.util.spec_from_file_location("build_exercise_library", SCRIPT_PATH)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


def test_convert_exercise_prefers_english_translation_and_main_image() -> None:
    raw = {
        "id": 57,
        "name": "Bear Walk",
        "description_text": "Beschreibung auf Deutsch",
        "category": {"name": "Chest"},
        "muscles_primary": [{"name_en": "Chest"}],
        "equipment": [{"name": "none (bodyweight exercise)"}],
        "license": {
            "short_name": "CC-BY-SA 4",
            "url": "https://creativecommons.org/licenses/by-sa/4.0/deed.en",
        },
        "license_author": "nate303303",
        "images": [
            {
                "url": "https://wger.de/media/exercise-images/57/secondary.jpg",
                "is_main": False,
                "license": {"author": ""},
            },
            {
                "url": "https://wger.de/media/exercise-images/57/main.jpg",
                "is_main": True,
                "license": {"author": "image-author"},
            },
        ],
        "translations": [
            {
                "language": {"code": "de"},
                "name": "Bear Walk",
                "aliases": [],
                "description_text": "Beschreibung auf Deutsch",
            },
            {
                "language": {"code": "en"},
                "name": "Bear Walk 2",
                "aliases": ["Bear Crawl"],
                "description_text": (
                    "Start in a quadruped position with knees hovering. "
                    "Move the opposite hand and foot together. "
                    "Stay braced through the trunk. "
                    "Keep the steps short and controlled."
                ),
            },
        ],
    }

    converted = MODULE.convert_exercise(raw)

    assert converted["name"] == "Bear Walk 2"
    assert converted["slug"] == "bear-walk-2"
    assert converted["aliases"] == ["Bear Walk 2", "Bear Crawl", "Bear Walk"]
    assert converted["summary"] == "Start in a quadruped position with knees hovering."
    assert converted["setup"] == "Start in a quadruped position with knees hovering."
    assert converted["cues"] == [
        "Move the opposite hand and foot together.",
        "Stay braced through the trunk.",
        "Keep the steps short and controlled.",
    ]
    assert converted["image_url"] == "https://wger.de/media/exercise-images/57/main.jpg"
    assert converted["source_url"] == "https://wger.de/media/exercise-images/57/main.jpg"
    assert converted["author"] == "image-author"


def test_convert_catalog_skips_entries_without_images_by_default() -> None:
    payload = {
        "exercises": [
            {
                "id": 1,
                "name": "Push-Up",
                "description_text": "Start in a plank. Lower with control. Press back up.",
                "category": {"name": "Chest"},
                "muscles_primary": [{"name_en": "Chest"}],
                "equipment": [],
                "license": {"short_name": "CC", "url": "https://example.com/license"},
                "license_author": "",
                "images": [],
                "translations": [{"language": {"code": "en"}, "name": "Push-Up"}],
            },
            {
                "id": 2,
                "name": "Pull-Up",
                "description_text": "Hang from the bar. Pull the chest up. Lower slowly.",
                "category": {"name": "Back"},
                "muscles_primary": [{"name_en": "Lats"}],
                "equipment": [],
                "license": {"short_name": "CC", "url": "https://example.com/license"},
                "license_author": "",
                "images": [{"url": "https://wger.de/media/exercise-images/2/main.png", "is_main": True}],
                "translations": [{"language": {"code": "en"}, "name": "Pull-Up"}],
            },
        ]
    }

    prepared = MODULE.convert_catalog_payload(payload)

    assert [item["name"] for item in prepared] == ["Pull-Up"]


def test_build_library_writes_wger_image_urls_without_downloading_assets(tmp_path) -> None:
    input_path = tmp_path / "wger.json"
    output_path = tmp_path / "catalog.json"

    payload = {
        "exercises": [
            {
                "id": 10,
                "name": "Hip Hinge",
                "description_text": "Stand tall. Push the hips back. Return to standing.",
                "category": {"name": "Legs"},
                "muscles_primary": [{"name_en": "Hamstrings"}, {"name_en": "Glutes"}],
                "equipment": [{"name": "dumbbell"}],
                "license": {"short_name": "CC", "url": "https://example.com/license"},
                "license_author": "coach",
                "images": [{"url": "https://wger.de/media/exercise-images/10/main.png", "is_main": True}],
                "translations": [{"language": {"code": "en"}, "name": "Hip Hinge"}],
            }
        ]
    }
    input_path.write_text(json.dumps(payload), encoding="utf-8")

    MODULE.build_library(input_path, output_path=output_path)

    catalog = json.loads(output_path.read_text(encoding="utf-8"))
    assert catalog[0]["name"] == "Hip Hinge"
    assert catalog[0]["image_url"] == "https://wger.de/media/exercise-images/10/main.png"
