from __future__ import annotations

import json
import logging
from pathlib import Path

from personal_trainer.db import create_workspace, upsert_checkin, upsert_profile
from personal_trainer.markdown_io import load_checkin, load_profile

LOGGER = logging.getLogger(__name__)


def import_filesystem_workspaces(workspaces_root: Path, *, database_url: str | None = None) -> int:
    imported = 0
    if not workspaces_root.exists():
        return imported

    for workspace_root in sorted(path for path in workspaces_root.iterdir() if path.is_dir()):
        profile_path = workspace_root / "profile.md"
        if not profile_path.exists():
            continue
        workspace_slug = workspace_root.name
        LOGGER.info("Importing filesystem workspace '%s'", workspace_slug)
        create_workspace(workspace_slug, database_url=database_url)
        upsert_profile(workspace_slug, load_profile(profile_path), database_url=database_url)
        checkins_dir = workspace_root / "checkins"
        if checkins_dir.exists():
            for checkin_path in sorted(checkins_dir.glob("*-checkin.md")):
                upsert_checkin(
                    workspace_slug,
                    load_checkin(checkin_path),
                    database_url=database_url,
                )
        imported += 1
    return imported


def import_recipe_snapshots_from_json(snapshot_export_path: Path, *, database_url: str | None = None) -> int:
    from personal_trainer.recipe_db import save_recipe_snapshot_row

    if not snapshot_export_path.exists():
        raise RuntimeError(f"Snapshot export file does not exist: {snapshot_export_path}")

    payload = json.loads(snapshot_export_path.read_text(encoding="utf-8"))
    snapshots = payload if isinstance(payload, list) else payload.get("snapshots", [])
    imported = 0
    for snapshot in snapshots:
        save_recipe_snapshot_row(snapshot, database_url=database_url)
        imported += 1
    return imported
