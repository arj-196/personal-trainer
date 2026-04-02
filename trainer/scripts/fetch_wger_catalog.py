#!/usr/bin/env python3
from __future__ import annotations

"""Fetch a raw exercise dump from the wger API.

The script writes a normalized JSON payload that the trainer repo can later feed
into `build_exercise_library.py`. By default it stores the dump in the repo's
`zsnippets/wger_exercise_catalog.json`.
"""

import json
import mimetypes
import os
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urljoin, urlparse
from urllib.request import Request, urlopen

import click


DEFAULT_BASE_URL = "https://wger.de"
DEFAULT_TIMEOUT = 30
DEFAULT_PAGE_SIZE = 200
DEFAULT_OUTPUT = (
    Path(__file__).resolve().parents[2] / "zsnippets" / "wger_exercise_catalog.json"
)
STYLE_LABELS = {
    1: "line",
    2: "3d",
    3: "low-poly",
    4: "photo",
    5: "other",
}
RETRYABLE_STATUS_CODES = {408, 429, 500, 502, 503, 504}


class HTMLTextExtractor(HTMLParser):
    """Convert the HTML descriptions returned by wger into readable text."""

    BLOCK_TAGS = {"p", "div", "section", "article", "blockquote", "ul", "ol"}
    BREAK_TAGS = {"br"}
    LIST_ITEM_TAGS = {"li"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in self.BLOCK_TAGS or tag in self.BREAK_TAGS:
            self.parts.append("\n")
        if tag in self.LIST_ITEM_TAGS:
            self.parts.append("\n- ")

    def handle_endtag(self, tag: str) -> None:
        if tag in self.BLOCK_TAGS or tag in self.LIST_ITEM_TAGS:
            self.parts.append("\n")

    def handle_data(self, data: str) -> None:
        self.parts.append(data)

    def text(self) -> str:
        raw = "".join(self.parts)
        raw = raw.replace("\xa0", " ")
        raw = re.sub(r"[ \t]+\n", "\n", raw)
        raw = re.sub(r"\n[ \t]+", "\n", raw)
        raw = re.sub(r"[ \t]{2,}", " ", raw)
        raw = re.sub(r"\n{3,}", "\n\n", raw)
        return raw.strip()


def html_to_text(value: str | None) -> str:
    if not value:
        return ""
    parser = HTMLTextExtractor()
    parser.feed(value)
    parser.close()
    return parser.text()


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def build_url(base_url: str, path: str, params: dict[str, Any] | None = None) -> str:
    url = (
        path
        if path.startswith("http://") or path.startswith("https://")
        else urljoin(base_url, path)
    )
    if not params:
        return url
    filtered = {key: value for key, value in params.items() if value is not None}
    query = urlencode(filtered, doseq=True)
    return f"{url}?{query}" if query else url


@dataclass(frozen=True)
class DownloadTask:
    url: str
    destination: Path


class WgerClient:
    def __init__(
        self,
        base_url: str,
        timeout: int = DEFAULT_TIMEOUT,
        retries: int = 3,
        user_agent: str = "wger-catalog-builder/1.0",
    ) -> None:
        self.base_url = base_url.rstrip("/") + "/"
        self.timeout = timeout
        self.retries = retries
        self.user_agent = user_agent

    def get_json(
        self, path_or_url: str, params: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        url = build_url(self.base_url, path_or_url, params)
        last_error: Exception | None = None

        for attempt in range(1, self.retries + 1):
            try:
                request = Request(
                    url,
                    headers={
                        "Accept": "application/json",
                        "User-Agent": self.user_agent,
                    },
                )
                with urlopen(request, timeout=self.timeout) as response:
                    return json.load(response)
            except HTTPError as exc:
                last_error = exc
                if exc.code not in RETRYABLE_STATUS_CODES or attempt == self.retries:
                    raise
            except (URLError, TimeoutError, json.JSONDecodeError) as exc:
                last_error = exc
                if attempt == self.retries:
                    raise

            time.sleep(min(2 ** (attempt - 1), 8))

        raise RuntimeError(f"Failed to fetch {url}: {last_error}")

    def paginate(
        self,
        path: str,
        params: dict[str, Any],
        max_items: int | None = None,
    ) -> list[dict[str, Any]]:
        results: list[dict[str, Any]] = []
        next_url = build_url(self.base_url, path, params)

        while next_url:
            payload = self.get_json(next_url)
            page_results = payload.get("results", [])
            if not isinstance(page_results, list):
                raise ValueError(f"Unexpected response shape for {next_url}")
            if max_items is None:
                results.extend(page_results)
            else:
                remaining = max_items - len(results)
                if remaining <= 0:
                    break
                results.extend(page_results[:remaining])
                if len(results) >= max_items:
                    break
            next_url = payload.get("next")

        return results


def fetch_language_map(client: WgerClient) -> dict[int, dict[str, Any]]:
    languages = client.paginate("/api/v2/language/", {"limit": 100})
    return {
        item["id"]: {
            "id": item["id"],
            "code": item.get("short_name"),
            "name": item.get("full_name_en") or item.get("full_name"),
            "native_name": item.get("full_name"),
        }
        for item in languages
    }


def normalize_license(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": item.get("id"),
        "full_name": item.get("full_name"),
        "short_name": item.get("short_name"),
        "url": item.get("url"),
    }


def normalize_muscle(muscle: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": muscle.get("id"),
        "name": muscle.get("name"),
        "name_en": muscle.get("name_en"),
        "is_front": muscle.get("is_front"),
        "image_url_main": muscle.get("image_url_main"),
        "image_url_secondary": muscle.get("image_url_secondary"),
    }


def normalize_equipment(equipment: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": equipment.get("id"),
        "name": equipment.get("name"),
    }


def normalize_image(image: dict[str, Any]) -> dict[str, Any]:
    raw_style_id = image.get("style")
    try:
        style_id = int(raw_style_id) if raw_style_id is not None else None
    except (TypeError, ValueError):
        style_id = None
    return {
        "id": image.get("id"),
        "uuid": image.get("uuid"),
        "url": image.get("image"),
        "is_main": image.get("is_main"),
        "style": {
            "id": style_id,
            "label": STYLE_LABELS.get(style_id),
        },
        "is_ai_generated": image.get("is_ai_generated"),
        "license": {
            "id": image.get("license"),
            "title": image.get("license_title"),
            "object_url": image.get("license_object_url"),
            "author": image.get("license_author"),
            "author_url": image.get("license_author_url"),
            "derivative_source_url": image.get("license_derivative_source_url"),
        },
        "author_history": image.get("author_history", []),
    }


def normalize_video(video: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": video.get("id"),
        "uuid": video.get("uuid"),
        "url": video.get("video"),
        "is_main": video.get("is_main"),
        "size_bytes": video.get("size"),
        "duration_seconds": video.get("duration"),
        "width": video.get("width"),
        "height": video.get("height"),
        "codec": video.get("codec"),
        "codec_long": video.get("codec_long"),
        "license": {
            "id": video.get("license"),
            "title": video.get("license_title"),
            "object_url": video.get("license_object_url"),
            "author": video.get("license_author"),
            "author_url": video.get("license_author_url"),
            "derivative_source_url": video.get("license_derivative_source_url"),
        },
        "author_history": video.get("author_history", []),
    }


def normalize_translation(
    translation: dict[str, Any],
    language_map: dict[int, dict[str, Any]],
) -> dict[str, Any]:
    description_html = translation.get("description") or ""
    notes = translation.get("notes", [])
    language_id = translation.get("language")

    return {
        "id": translation.get("id"),
        "uuid": translation.get("uuid"),
        "language": language_map.get(language_id, {"id": language_id}),
        "name": translation.get("name"),
        "aliases": [
            alias.get("alias")
            for alias in translation.get("aliases", [])
            if alias.get("alias")
        ],
        "description_html": description_html,
        "description_text": html_to_text(description_html),
        "best_practices": [note.get("comment") for note in notes if note.get("comment")],
        "notes": [
            {
                "id": note.get("id"),
                "uuid": note.get("uuid"),
                "comment": note.get("comment"),
            }
            for note in notes
        ],
        "license": {
            "id": translation.get("license"),
            "title": translation.get("license_title"),
            "object_url": translation.get("license_object_url"),
            "author": translation.get("license_author"),
            "author_url": translation.get("license_author_url"),
            "derivative_source_url": translation.get("license_derivative_source_url"),
        },
        "author_history": translation.get("author_history", []),
    }


def normalize_exercise(
    exercise: dict[str, Any],
    language_map: dict[int, dict[str, Any]],
) -> dict[str, Any]:
    translations = [
        normalize_translation(translation, language_map)
        for translation in exercise.get("translations", [])
    ]
    primary_translation = translations[0] if translations else {}

    return {
        "id": exercise.get("id"),
        "uuid": exercise.get("uuid"),
        "created": exercise.get("created"),
        "last_update": exercise.get("last_update"),
        "last_update_global": exercise.get("last_update_global"),
        "name": primary_translation.get("name"),
        "description_html": primary_translation.get("description_html"),
        "description_text": primary_translation.get("description_text"),
        "best_practices": primary_translation.get("best_practices", []),
        "category": exercise.get("category"),
        "muscles_primary": [
            normalize_muscle(muscle) for muscle in exercise.get("muscles", [])
        ],
        "muscles_secondary": [
            normalize_muscle(muscle) for muscle in exercise.get("muscles_secondary", [])
        ],
        "equipment": [
            normalize_equipment(item) for item in exercise.get("equipment", [])
        ],
        "license": normalize_license(exercise.get("license", {})),
        "license_author": exercise.get("license_author"),
        "images": [normalize_image(image) for image in exercise.get("images", [])],
        "videos": [normalize_video(video) for video in exercise.get("videos", [])],
        "translation_count": len(translations),
        "translations": translations,
        "variation_count": exercise.get("variations"),
        "author_history": exercise.get("author_history", []),
        "total_authors_history": exercise.get("total_authors_history", []),
    }


def extension_for_url(url: str, fallback: str) -> str:
    parsed = urlparse(url)
    suffix = Path(parsed.path).suffix
    if suffix:
        return suffix
    guessed = mimetypes.guess_extension(mimetypes.guess_type(url)[0] or "")
    return guessed or fallback


def build_download_tasks(
    exercises: list[dict[str, Any]], media_root: Path
) -> list[DownloadTask]:
    tasks: list[DownloadTask] = []
    for exercise in exercises:
        for image in exercise.get("images", []):
            url = image.get("url")
            if not url:
                continue
            ext = extension_for_url(url, ".jpg")
            destination = (
                media_root
                / "images"
                / f"exercise_{exercise['id']}"
                / f"{image['uuid']}{ext}"
            )
            image["local_path"] = str(destination)
            tasks.append(DownloadTask(url=url, destination=destination))

        for video in exercise.get("videos", []):
            url = video.get("url")
            if not url:
                continue
            ext = extension_for_url(url, ".mp4")
            destination = (
                media_root
                / "videos"
                / f"exercise_{exercise['id']}"
                / f"{video['uuid']}{ext}"
            )
            video["local_path"] = str(destination)
            tasks.append(DownloadTask(url=url, destination=destination))

    return tasks


def download_one(task: DownloadTask, timeout: int) -> tuple[str, str]:
    task.destination.parent.mkdir(parents=True, exist_ok=True)
    request = Request(task.url, headers={"User-Agent": "wger-catalog-builder/1.0"})
    with urlopen(request, timeout=timeout) as response:
        with task.destination.open("wb") as handle:
            handle.write(response.read())
    return task.url, str(task.destination)


def download_media(tasks: list[DownloadTask], timeout: int, workers: int) -> dict[str, Any]:
    downloaded: list[dict[str, str]] = []
    failed: list[dict[str, str]] = []

    with ThreadPoolExecutor(max_workers=workers) as executor:
        future_map = {
            executor.submit(download_one, task, timeout): task for task in tasks
        }
        for future in as_completed(future_map):
            task = future_map[future]
            try:
                url, destination = future.result()
                downloaded.append({"url": url, "path": destination})
            except Exception as exc:  # noqa: BLE001
                failed.append(
                    {"url": task.url, "path": str(task.destination), "error": str(exc)}
                )

    return {
        "attempted": len(tasks),
        "downloaded": len(downloaded),
        "failed": len(failed),
        "errors": failed,
    }


def fetch_catalog(
    *,
    base_url: str,
    language_code: str,
    page_size: int,
    output_path: Path,
    timeout: int,
    retries: int,
    max_exercises: int | None,
    download_media_dir: Path | None,
    download_workers: int,
) -> Path:
    client = WgerClient(base_url=base_url, timeout=timeout, retries=retries)

    params: dict[str, Any] = {"limit": page_size}
    if language_code:
        params["language__code"] = language_code

    language_map = fetch_language_map(client)
    raw_exercises = client.paginate(
        "/api/v2/exerciseinfo/",
        params,
        max_items=max_exercises,
    )
    exercises = [
        normalize_exercise(exercise, language_map) for exercise in raw_exercises
    ]

    media_summary = None
    if download_media_dir is not None:
        tasks = build_download_tasks(exercises, download_media_dir)
        media_summary = download_media(
            tasks, timeout=timeout, workers=download_workers
        )

    catalog = {
        "metadata": {
            "source": {
                "name": "wger",
                "base_url": base_url.rstrip("/"),
                "exerciseinfo_endpoint": "/api/v2/exerciseinfo/",
                "language_endpoint": "/api/v2/language/",
            },
            "generated_at": utc_now_iso(),
            "language_filter": language_code or None,
            "page_size": page_size,
            "exercise_count": len(exercises),
            "media_download": media_summary,
        },
        "exercises": exercises,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(catalog, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    return output_path


@click.command(help="Fetch a raw exercise dump from the wger API.")
@click.option(
    "--base-url",
    default=DEFAULT_BASE_URL,
    show_default=True,
    help="wger API host.",
)
@click.option(
    "--language-code",
    default="en",
    show_default=True,
    help="Filter exercise translations by language code. Pass an empty string to fetch all languages.",
)
@click.option(
    "--page-size",
    type=int,
    default=DEFAULT_PAGE_SIZE,
    show_default=True,
    help="API page size.",
)
@click.option(
    "--output",
    "output_path",
    type=click.Path(dir_okay=False, path_type=Path),
    default=DEFAULT_OUTPUT,
    show_default=True,
    help="Output JSON path.",
)
@click.option(
    "--timeout",
    type=int,
    default=DEFAULT_TIMEOUT,
    show_default=True,
    help="HTTP timeout in seconds.",
)
@click.option(
    "--retries",
    type=int,
    default=3,
    show_default=True,
    help="Retry count for transient failures.",
)
@click.option(
    "--max-exercises",
    type=int,
    default=None,
    help="Stop after this many exercises. Useful for testing.",
)
@click.option(
    "--download-media-dir",
    type=click.Path(file_okay=False, path_type=Path),
    default=None,
    help="Optional directory to download exercise images and videos into.",
)
@click.option(
    "--download-workers",
    type=int,
    default=min(8, (os.cpu_count() or 4)),
    show_default=True,
    help="Parallel media download workers.",
)
def main(
    base_url: str,
    language_code: str,
    page_size: int,
    output_path: Path,
    timeout: int,
    retries: int,
    max_exercises: int | None,
    download_media_dir: Path | None,
    download_workers: int,
) -> None:
    output = fetch_catalog(
        base_url=base_url,
        language_code=language_code,
        page_size=page_size,
        output_path=output_path,
        timeout=timeout,
        retries=retries,
        max_exercises=max_exercises,
        download_media_dir=download_media_dir,
        download_workers=download_workers,
    )
    click.echo(f"Wrote catalog to {output}")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        raise SystemExit(130)
