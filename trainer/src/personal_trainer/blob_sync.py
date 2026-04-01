from __future__ import annotations

import mimetypes
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

BlobAccess = Literal["public", "private"]

DEFAULT_BLOB_PREFIX = "personal-trainer"
LIBRARY_ASSETS_ROOT = Path(__file__).resolve().parent / "assets" / "exercise_library"
RECIPE_ASSETS_ROOT = Path(__file__).resolve().parent / "assets" / "recipes"


class BlobPublishError(RuntimeError):
    """Raised when publishing trainer data to Vercel Blob fails."""


@dataclass(frozen=True, slots=True)
class BlobPublishResult:
    workspace: str
    prefix: str
    access: BlobAccess
    workspace_files_uploaded: int
    library_files_uploaded: int
    remote_files_deleted: int


def publish_workspace_to_blob(
    workspace_root: Path,
    *,
    prefix: str | None = None,
    access: BlobAccess = "private",
    include_library: bool = True,
) -> BlobPublishResult:
    if not workspace_root.exists():
        raise BlobPublishError(f"Workspace does not exist: {workspace_root}")

    normalized_prefix = _normalize_prefix(prefix)
    workspace_name = workspace_root.name
    workspace_blob_root = _blob_path(normalized_prefix, "workspaces", workspace_name)
    library_blob_root = _blob_path(normalized_prefix, "exercise-library")
    recipes_blob_root = _blob_path(normalized_prefix, "recipes")

    try:
        client = _build_blob_client()
    except (
        Exception
    ) as error:  # pragma: no cover - defensive around optional env/runtime failures
        raise BlobPublishError(str(error)) from error

    remote_files_deleted = 0
    workspace_files_uploaded = 0
    library_files_uploaded = 0

    with client:
        remote_files_deleted += _delete_prefix(client, f"{workspace_blob_root}/")
        if include_library:
            remote_files_deleted += _delete_prefix(client, f"{library_blob_root}/")
            remote_files_deleted += _delete_prefix(client, f"{recipes_blob_root}/")

        for file_path in _iter_workspace_files(workspace_root):
            relative_path = file_path.relative_to(workspace_root).as_posix()
            client.upload_file(
                file_path,
                _blob_path(workspace_blob_root, relative_path),
                access=access,
                content_type=_content_type_for(file_path),
                overwrite=True,
                add_random_suffix=False,
                cache_control_max_age=_cache_control_max_age(file_path),
            )
            workspace_files_uploaded += 1

        if include_library:
            for file_path in _iter_library_files():
                relative_path = file_path.relative_to(LIBRARY_ASSETS_ROOT).as_posix()
                client.upload_file(
                    file_path,
                    _blob_path(library_blob_root, relative_path),
                    access=access,
                    content_type=_content_type_for(file_path),
                    overwrite=True,
                    add_random_suffix=False,
                    cache_control_max_age=_cache_control_max_age(file_path),
                )
                library_files_uploaded += 1
            for file_path in _iter_recipe_files():
                relative_path = file_path.relative_to(RECIPE_ASSETS_ROOT).as_posix()
                client.upload_file(
                    file_path,
                    _blob_path(recipes_blob_root, relative_path),
                    access=access,
                    content_type=_content_type_for(file_path),
                    overwrite=True,
                    add_random_suffix=False,
                    cache_control_max_age=_cache_control_max_age(file_path),
                )
                library_files_uploaded += 1

    return BlobPublishResult(
        workspace=workspace_name,
        prefix=normalized_prefix,
        access=access,
        workspace_files_uploaded=workspace_files_uploaded,
        library_files_uploaded=library_files_uploaded,
        remote_files_deleted=remote_files_deleted,
    )


def default_blob_prefix() -> str:
    return _normalize_prefix(os.getenv("TRAINER_BLOB_PREFIX"))


def default_blob_access() -> BlobAccess:
    return "public" if os.getenv("TRAINER_BLOB_ACCESS") == "public" else "private"


def _build_blob_client():
    try:
        from vercel.blob import BlobClient
    except ImportError as error:  # pragma: no cover - depends on installation state
        raise BlobPublishError(
            "The 'vercel' package is not installed. Run 'poetry install' in trainer/."
        ) from error

    token = os.getenv("BLOB_READ_WRITE_TOKEN")
    if not token:
        raise BlobPublishError(
            "BLOB_READ_WRITE_TOKEN is not set. Add it before publishing to Vercel Blob."
        )

    return BlobClient(token=token)


def _delete_prefix(client, prefix: str) -> int:
    remote_paths = [item.pathname for item in client.iter_objects(prefix=prefix)]
    if remote_paths:
        client.delete(remote_paths)
    return len(remote_paths)


def _iter_workspace_files(workspace_root: Path) -> list[Path]:
    files: list[Path] = []

    for name in (
        "profile.md",
        "profile.json",
        "plan.md",
        "plan.json",
        "coach_notes.md",
    ):
        candidate = workspace_root / name
        if candidate.exists():
            files.append(candidate)

    files.extend(
        path
        for pattern in ("plan-*.md", "plan-*.json", "coach-notes-*.md")
        for path in workspace_root.glob(pattern)
        if path.is_file() and not path.name.startswith(".")
    )

    library_dir = workspace_root / "exercise_library"
    if library_dir.exists():
        files.extend(
            path
            for path in library_dir.rglob("*")
            if path.is_file() and not path.name.startswith(".")
        )

    return sorted(files)


def _iter_library_files() -> list[Path]:
    return sorted(
        path
        for path in LIBRARY_ASSETS_ROOT.rglob("*")
        if path.is_file() and not path.name.startswith(".")
    )


def _iter_recipe_files() -> list[Path]:
    return sorted(
        path
        for path in RECIPE_ASSETS_ROOT.rglob("*")
        if path.is_file() and not path.name.startswith(".")
    )


def _normalize_prefix(prefix: str | None) -> str:
    raw = (prefix or DEFAULT_BLOB_PREFIX).strip().strip("/")
    return raw or DEFAULT_BLOB_PREFIX


def _blob_path(*parts: str) -> str:
    return "/".join(part.strip("/") for part in parts if part and part.strip("/"))


def _content_type_for(file_path: Path) -> str:
    if file_path.suffix.lower() == ".md":
        return "text/markdown; charset=utf-8"
    content_type, _ = mimetypes.guess_type(file_path.name)
    return content_type or "application/octet-stream"


def _cache_control_max_age(file_path: Path) -> int:
    if file_path.suffix.lower() in {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"}:
        return 60 * 60 * 24
    return 60
