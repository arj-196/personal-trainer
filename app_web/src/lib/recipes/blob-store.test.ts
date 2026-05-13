import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  queryMock,
  queryOneMock,
} = vi.hoisted(() => ({
  queryMock: vi.fn(),
  queryOneMock: vi.fn(),
}));

vi.mock('@/lib/server/db', () => ({
  query: queryMock,
  queryOne: queryOneMock,
}));

import { saveRecipeSnapshot, listRecipeSnapshots, getRecipeSnapshot, deleteRecipeSnapshot } from '@/lib/server/recipes-db';
import { createRecipeState } from './state';
import type { Recommendation } from './types';

const recommendation: Recommendation = {
  id: 'spicy-chicken',
  title: 'Spicy Chicken',
  summary: 'Fast dinner',
  rationale: 'Uses chicken.',
  totalMinutes: 15,
  ingredientLines: ['200 g chicken', '1 tsp salt'],
  availableIngredientsUsed: ['chicken'],
  availableIngredientsUnused: [],
  extraIngredients: ['salt'],
  steps: ['Cook the chicken.'],
};

describe('recipe postgres store', () => {
  beforeEach(() => {
    queryMock.mockReset();
    queryOneMock.mockReset();
  });

  it('saves immutable snapshots to Postgres', async () => {
    queryMock.mockResolvedValue([]);
    const snapshot = await saveRecipeSnapshot(
      createRecipeState({ ingredients: ['chicken'], notesRaw: 'spicy', mode: 'hybrid' }),
      recommendation
    );

    expect(snapshot.id).toContain('spicy-chicken');
    expect(queryMock).toHaveBeenCalled();
  });

  it('lists saved snapshots ordered by timestamp', async () => {
    queryMock.mockResolvedValue([
      {
        id: 'newer',
        saved_at: '2026-04-02T10:00:00.000Z',
        recommendation: { ...recommendation, id: 'newer', title: 'Newer' },
      },
      {
        id: 'older',
        saved_at: '2026-04-01T10:00:00.000Z',
        recommendation: { ...recommendation, id: 'older', title: 'Older' },
      },
    ]);

    const items = await listRecipeSnapshots();
    expect(items.map((item) => item.id)).toEqual(['newer', 'older']);
  });

  it('loads and deletes a snapshot by id', async () => {
    queryOneMock.mockResolvedValue({
      id: 'target',
      saved_at: '2026-04-02T10:00:00.000Z',
      recipe_state: createRecipeState({ ingredients: ['chicken'], notesRaw: '', mode: 'hybrid' }),
      recommendation,
    });
    queryMock.mockResolvedValue([{ id: 'target' }]);

    await expect(getRecipeSnapshot('target')).resolves.toMatchObject({ id: 'target' });
    await expect(deleteRecipeSnapshot('target')).resolves.toBe(true);
  });
});
