import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@vercel/blob', () => ({
  del: vi.fn(),
  get: vi.fn(),
  list: vi.fn(),
  put: vi.fn(),
}));

import { del, get, list, put } from '@vercel/blob';

import { deleteRecipeSnapshot, getRecipeSnapshot, listRecipeSnapshots, saveRecipeSnapshot } from './blob-store';
import { createRecipeState } from './state';
import type { Recommendation, SavedRecipeSnapshot } from './types';

const mockedDel = vi.mocked(del);
const mockedGet = vi.mocked(get);
const mockedList = vi.mocked(list);
const mockedPut = vi.mocked(put);

const recommendation: Recommendation = {
  id: 'spicy-chicken',
  title: 'Spicy Chicken',
  summary: 'Fast dinner',
  rationale: 'Uses chicken.',
  totalMinutes: 15,
  availableIngredientsUsed: ['chicken'],
  availableIngredientsUnused: [],
  extraIngredients: ['salt'],
  steps: ['Cook the chicken.'],
};

function blobResponse(snapshot: SavedRecipeSnapshot, pathname: string) {
  const text = JSON.stringify(snapshot);
  return {
    statusCode: 200 as const,
    stream: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(text));
        controller.close();
      },
    }),
    headers: new Headers(),
    blob: {
      url: `https://example.test/${pathname}`,
      downloadUrl: `https://example.test/${pathname}`,
      pathname,
      contentDisposition: 'inline',
      cacheControl: 'public, max-age=3600',
      uploadedAt: new Date(snapshot.savedAt),
      etag: 'etag',
      contentType: 'application/json',
      size: text.length,
    },
  };
}

describe('recipe blob store', () => {
  beforeEach(() => {
    mockedDel.mockReset();
    mockedGet.mockReset();
    mockedList.mockReset();
    mockedPut.mockReset();
  });

  it('saves immutable snapshots to the saved-recipes prefix', async () => {
    const snapshot = await saveRecipeSnapshot(
      createRecipeState({ ingredients: ['chicken'], notesRaw: 'spicy', mode: 'hybrid' }),
      recommendation
    );

    expect(snapshot.id).toContain('spicy-chicken');
    expect(mockedPut).toHaveBeenCalledOnce();
    expect(mockedPut.mock.calls[0]?.[0]).toContain('saved-recipes/');
  });

  it('lists and loads saved snapshots ordered by timestamp', async () => {
    const snapshots: SavedRecipeSnapshot[] = [
      {
        id: 'older',
        savedAt: '2026-04-01T10:00:00.000Z',
        recipeState: createRecipeState({ ingredients: ['rice'], notesRaw: '', mode: 'hybrid' }),
        recommendation: { ...recommendation, id: 'older', title: 'Older' },
      },
      {
        id: 'newer',
        savedAt: '2026-04-02T10:00:00.000Z',
        recipeState: createRecipeState({ ingredients: ['chicken'], notesRaw: '', mode: 'hybrid' }),
        recommendation: { ...recommendation, id: 'newer', title: 'Newer' },
      },
    ];

    mockedList.mockResolvedValue({
      blobs: [
        { pathname: 'personal-trainer/saved-recipes/2026/04/recipe_older.json' },
        { pathname: 'personal-trainer/saved-recipes/2026/04/recipe_newer.json' },
      ],
      folders: [],
      cursor: undefined,
      hasMore: false,
    } as never);
    mockedGet.mockImplementation(async (pathname: string) => {
      const snapshot = pathname.includes('newer') ? snapshots[1] : snapshots[0];
      return blobResponse(snapshot, pathname) as never;
    });

    const items = await listRecipeSnapshots();
    const loaded = await getRecipeSnapshot('newer');

    expect(items.map((item) => item.id)).toEqual(['newer', 'older']);
    expect(loaded?.recommendation.title).toBe('Newer');
  });

  it('deletes a snapshot by id after resolving the backing pathname', async () => {
    mockedList.mockResolvedValue({
      blobs: [{ pathname: 'personal-trainer/saved-recipes/2026/04/recipe_target.json' }],
      folders: [],
      cursor: undefined,
      hasMore: false,
    } as never);
    mockedGet.mockResolvedValue(blobResponse({
      id: 'target',
      savedAt: '2026-04-02T10:00:00.000Z',
      recipeState: createRecipeState({ ingredients: ['chicken'], notesRaw: '', mode: 'hybrid' }),
      recommendation,
    }, 'personal-trainer/saved-recipes/2026/04/recipe_target.json') as never);

    await expect(deleteRecipeSnapshot('target')).resolves.toBe(true);
    expect(mockedDel).toHaveBeenCalledWith('personal-trainer/saved-recipes/2026/04/recipe_target.json');
  });
});
