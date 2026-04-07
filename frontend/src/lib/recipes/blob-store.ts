import { del, get, list, put } from '@vercel/blob';

import { blobPath, getBlobAccess } from '@/lib/storage-config';
import { logger } from '@/lib/server/logger';

import type { Recommendation, RecipeState, SavedRecipeSnapshot } from './types';

export type SavedRecipeListItem = {
  id: string;
  savedAt: string;
  title: string;
  summary: string;
  pathname: string;
};

export async function saveRecipeSnapshot(recipeState: RecipeState, recommendation: Recommendation): Promise<SavedRecipeSnapshot> {
  const savedAt = new Date().toISOString();
  const id = buildSnapshotId(savedAt, recommendation.id);
  const pathname = snapshotPath(savedAt, id);
  const snapshot: SavedRecipeSnapshot = {
    id,
    savedAt,
    recipeState,
    recommendation,
  };

  logger.info('Saving recipe snapshot', { pathname, id });
  await put(pathname, JSON.stringify(snapshot, null, 2), {
    access: getBlobAccess(),
    contentType: 'application/json; charset=utf-8',
    addRandomSuffix: false,
    allowOverwrite: false,
  });

  return snapshot;
}

export async function listRecipeSnapshots(): Promise<SavedRecipeListItem[]> {
  logger.info('Listing recipe snapshots');
  let cursor: string | undefined;
  const items: SavedRecipeListItem[] = [];

  do {
    const result = await list({
      cursor,
      prefix: blobPath('saved-recipes') + '/',
    });

    for (const blob of result.blobs) {
      const snapshot = await readSnapshotByPath(blob.pathname);
      if (snapshot) {
        items.push({
          id: snapshot.id,
          savedAt: snapshot.savedAt,
          title: snapshot.recommendation.title,
          summary: snapshot.recommendation.summary,
          pathname: blob.pathname,
        });
      }
    }
    cursor = result.hasMore ? result.cursor : undefined;
  } while (cursor);

  return items.sort((left, right) => right.savedAt.localeCompare(left.savedAt));
}

export async function getRecipeSnapshot(id: string): Promise<SavedRecipeSnapshot | null> {
  logger.info('Reading recipe snapshot by id', { id });
  const snapshots = await listRecipeSnapshots();
  const match = snapshots.find((item) => item.id === id);
  if (!match) {
    return null;
  }
  return readSnapshotByPath(match.pathname);
}

export async function deleteRecipeSnapshot(id: string): Promise<boolean> {
  logger.info('Deleting recipe snapshot', { id });
  const snapshots = await listRecipeSnapshots();
  const match = snapshots.find((item) => item.id === id);
  if (!match) {
    return false;
  }

  await del(match.pathname);
  return true;
}

async function readSnapshotByPath(pathname: string): Promise<SavedRecipeSnapshot | null> {
  const result = await get(pathname, { access: getBlobAccess() });
  if (!result || result.statusCode !== 200 || !result.stream) {
    return null;
  }

  const text = await new Response(result.stream).text();
  return JSON.parse(text) as SavedRecipeSnapshot;
}

function snapshotPath(savedAt: string, id: string): string {
  const [year, month] = savedAt.split('T')[0]?.split('-') ?? [];
  return blobPath('saved-recipes', year, month, `recipe_${id}.json`);
}

function buildSnapshotId(savedAt: string, recommendationId: string): string {
  const timestamp = savedAt.replace(/[-:.TZ]/g, '').slice(0, 14);
  const cleanId = recommendationId.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/(^-|-$)/g, '');
  return `${timestamp}_${cleanId || 'recipe'}`;
}
