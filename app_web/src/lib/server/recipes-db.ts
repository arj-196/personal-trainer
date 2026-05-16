import type { Recommendation, RecipeState, SavedRecipeSnapshot } from '@/lib/recipes/types';

import { query, queryOne } from './db';
import { createLogger } from './logger';

const logger = createLogger('app_web.server.recipes-db');

export type SavedRecipeListItem = {
  id: string;
  savedAt: string;
  title: string;
  summary: string;
};

export async function saveRecipeSnapshot(recipeState: RecipeState, recommendation: Recommendation): Promise<SavedRecipeSnapshot> {
  const savedAt = new Date().toISOString();
  const id = buildSnapshotId(savedAt, recommendation.id);
  const snapshot: SavedRecipeSnapshot = {
    id,
    savedAt,
    recipeState,
    recommendation,
  };

  logger.info('Saving recipe snapshot to Postgres', { id });
  await query(
    `
    WITH default_workspace AS (
      INSERT INTO recipe_workspaces (slug, draft, committed, has_pending_changes)
      VALUES ('default', '{"ingredients":[],"notesRaw":"","mode":"hybrid","parsedConstraints":{"methodTags":[],"dietTags":[],"flavorTags":[],"exclusions":[]}}'::jsonb, NULL, FALSE)
      ON CONFLICT (slug) DO UPDATE SET updated_at = NOW()
      RETURNING id
    )
    INSERT INTO saved_recipe_snapshots (id, saved_at, recipe_workspace_id, recipe_state, recommendation)
    SELECT $1, $2, id, $3::jsonb, $4::jsonb FROM default_workspace
    ON CONFLICT (id) DO UPDATE SET
      saved_at = EXCLUDED.saved_at,
      recipe_workspace_id = EXCLUDED.recipe_workspace_id,
      recipe_state = EXCLUDED.recipe_state,
      recommendation = EXCLUDED.recommendation,
      updated_at = NOW()
    `,
    [id, savedAt, JSON.stringify(recipeState), JSON.stringify(recommendation)]
  );

  return snapshot;
}

export async function listRecipeSnapshots(): Promise<SavedRecipeListItem[]> {
  const rows = await query<Record<string, unknown>>(
    `
    SELECT id, saved_at, recommendation
    FROM saved_recipe_snapshots
    ORDER BY saved_at DESC
    `
  );
  return rows.map((row) => {
    const recommendation = row.recommendation as Recommendation;
    return {
      id: String(row.id),
      savedAt: new Date(String(row.saved_at)).toISOString(),
      title: recommendation.title,
      summary: recommendation.summary,
    };
  });
}

export async function getRecipeSnapshot(id: string): Promise<SavedRecipeSnapshot | null> {
  const row = await queryOne<Record<string, unknown>>(
    `
    SELECT id, saved_at, recipe_state, recommendation
    FROM saved_recipe_snapshots
    WHERE id = $1
    `,
    [id]
  );
  if (!row) {
    return null;
  }
  return {
    id: String(row.id),
    savedAt: new Date(String(row.saved_at)).toISOString(),
    recipeState: row.recipe_state as RecipeState,
    recommendation: row.recommendation as Recommendation,
  };
}

export async function deleteRecipeSnapshot(id: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    'DELETE FROM saved_recipe_snapshots WHERE id = $1 RETURNING id',
    [id]
  );
  return rows.length > 0;
}

function buildSnapshotId(savedAt: string, recommendationId: string): string {
  const timestamp = savedAt.replace(/[-:.TZ]/g, '').slice(0, 14);
  const cleanId = recommendationId.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/(^-|-$)/g, '');
  return `${timestamp}_${cleanId || 'recipe'}`;
}
