from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from personal_trainer.db import connect


def ensure_default_recipe_workspace(*, database_url: str | None = None) -> str:
    with connect(database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO recipe_workspaces (slug, draft, committed, has_pending_changes)
                VALUES ('default', %s::jsonb, NULL, FALSE)
                ON CONFLICT (slug) DO NOTHING
                RETURNING id
                """,
                (json.dumps({"ingredients": [], "notesRaw": "", "mode": "hybrid", "parsedConstraints": {"methodTags": [], "dietTags": [], "flavorTags": [], "exclusions": []}}),),
            )
            row = cursor.fetchone()
            if row is None:
                cursor.execute("SELECT id FROM recipe_workspaces WHERE slug = 'default'")
                row = cursor.fetchone()
        connection.commit()
        return str(row["id"])


def save_recipe_snapshot_row(snapshot: dict[str, Any], *, database_url: str | None = None) -> None:
    workspace_id = ensure_default_recipe_workspace(database_url=database_url)
    saved_at = snapshot.get("savedAt") or snapshot.get("saved_at") or datetime.utcnow().isoformat()
    with connect(database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO saved_recipe_snapshots (
                    id, saved_at, recipe_workspace_id, recipe_state, recommendation, created_at, updated_at
                )
                VALUES (%s, %s, %s, %s::jsonb, %s::jsonb, NOW(), NOW())
                ON CONFLICT (id) DO UPDATE SET
                    saved_at = EXCLUDED.saved_at,
                    recipe_workspace_id = EXCLUDED.recipe_workspace_id,
                    recipe_state = EXCLUDED.recipe_state,
                    recommendation = EXCLUDED.recommendation,
                    updated_at = NOW()
                """,
                (
                    snapshot["id"],
                    saved_at,
                    workspace_id,
                    json.dumps(snapshot["recipeState"]),
                    json.dumps(snapshot["recommendation"]),
                ),
            )
        connection.commit()
