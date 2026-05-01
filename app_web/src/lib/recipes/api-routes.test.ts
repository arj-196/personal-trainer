import { beforeEach, describe, expect, it, vi } from 'vitest';

const { transcribeAudioMock } = vi.hoisted(() => ({
  transcribeAudioMock: vi.fn(async () => 'potatoes and chicken'),
}));

vi.mock('@/lib/recipes/openai', () => ({
  transcribeAudio: transcribeAudioMock,
}));

vi.mock('@/lib/recipes/service', () => ({
  RecipeValidationError: class RecipeValidationError extends Error {
    details: string[];

    constructor(message: string, details: string[] = []) {
      super(message);
      this.details = details;
    }
  },
  interpretRecipeUtterance: vi.fn(async (transcript: string, draft: { ingredients: string[]; notesRaw: string; mode: string; parsedConstraints: unknown }) => ({
    transcript,
    intent: 'add_ingredients',
    statePatch: { ingredients: ['potato', 'chicken'] },
    explanation: 'Added ingredients.',
    updatedDraft: { ...draft, ingredients: ['potato', 'chicken'] },
  })),
  generateValidatedRecommendations: vi.fn(async () => ([
    {
      id: 'recipe-1',
      title: 'Recipe 1',
      summary: 'One',
      rationale: 'First',
      totalMinutes: 15,
      availableIngredientsUsed: ['chicken'],
      availableIngredientsUnused: [],
      extraIngredients: [],
      steps: ['Cook.'],
    },
    {
      id: 'recipe-2',
      title: 'Recipe 2',
      summary: 'Two',
      rationale: 'Second',
      totalMinutes: 20,
      availableIngredientsUsed: ['chicken'],
      availableIngredientsUnused: [],
      extraIngredients: [],
      steps: ['Cook.'],
    },
    {
      id: 'recipe-3',
      title: 'Recipe 3',
      summary: 'Three',
      rationale: 'Third',
      totalMinutes: 25,
      availableIngredientsUsed: ['chicken'],
      availableIngredientsUnused: [],
      extraIngredients: [],
      steps: ['Cook.'],
    },
  ])),
}));

vi.mock('@/lib/recipes/blob-store', () => ({
  saveRecipeSnapshot: vi.fn(async (_state, recommendation) => ({
    id: 'saved-1',
    savedAt: '2026-04-07T10:00:00.000Z',
    recipeState: _state,
    recommendation,
  })),
  listRecipeSnapshots: vi.fn(async () => [
    {
      id: 'saved-1',
      savedAt: '2026-04-07T10:00:00.000Z',
      title: 'Recipe 1',
      summary: 'One',
      pathname: 'personal-trainer/saved-recipes/2026/04/recipe_saved-1.json',
    },
  ]),
  getRecipeSnapshot: vi.fn(async () => ({
    id: 'saved-1',
    savedAt: '2026-04-07T10:00:00.000Z',
    recipeState: {
      ingredients: ['chicken'],
      notesRaw: '',
      mode: 'hybrid',
      parsedConstraints: { methodTags: [], dietTags: [], flavorTags: [], exclusions: [] },
    },
    recommendation: {
      id: 'recipe-1',
      title: 'Recipe 1',
      summary: 'One',
      rationale: 'First',
      totalMinutes: 15,
      availableIngredientsUsed: ['chicken'],
      availableIngredientsUnused: [],
      extraIngredients: [],
      steps: ['Cook.'],
    },
  })),
  deleteRecipeSnapshot: vi.fn(async () => true),
}));

import { POST as transcribePost } from '../../../app/api/transcribe/route';
import { POST as interpretPost } from '../../../app/api/interpret-utterance/route';
import { POST as generatePost } from '../../../app/api/generate-recommendations/route';
import { POST as savePost } from '../../../app/api/save-recipe/route';
import { GET as listSavedGet } from '../../../app/api/saved-recipes/route';
import { DELETE as deleteSavedDelete, GET as getSavedGet } from '../../../app/api/saved-recipes/[id]/route';

describe('recipe API routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a transcript from the transcribe route', async () => {
    const formData = new FormData();
    formData.set('audio', new File(['audio'], 'clip.m4a', { type: 'audio/mp4' }));
    const response = await transcribePost(new Request('http://localhost/api/transcribe', {
      method: 'POST',
      body: formData,
    }));

    await expect(response.json()).resolves.toEqual({ transcript: 'potatoes and chicken' });
    expect(transcribeAudioMock).toHaveBeenCalledTimes(1);
    const [uploadedFile] = transcribeAudioMock.mock.calls[0] as [File];
    expect(uploadedFile.name).toBe('clip.m4a');
    expect(uploadedFile.type).toBe('audio/mp4');
  });

  it('returns interpreted draft updates', async () => {
    const response = await interpretPost(new Request('http://localhost/api/interpret-utterance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript: 'add potatoes',
        draft: {
          ingredients: ['chicken'],
          notesRaw: '',
          mode: 'hybrid',
          parsedConstraints: { methodTags: [], dietTags: [], flavorTags: [], exclusions: [] },
        },
      }),
    }));

    const payload = await response.json() as { result: { updatedDraft: { ingredients: string[] } } };
    expect(payload.result.updatedDraft.ingredients).toEqual(['potato', 'chicken']);
  });

  it('returns exactly three recommendations from the generate route', async () => {
    const response = await generatePost(new Request('http://localhost/api/generate-recommendations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipeState: {
          ingredients: ['chicken'],
          notesRaw: '',
          mode: 'hybrid',
          parsedConstraints: { methodTags: [], dietTags: [], flavorTags: [], exclusions: [] },
        },
      }),
    }));

    const payload = await response.json() as { recommendations: Array<{ id: string }> };
    expect(payload.recommendations).toHaveLength(3);
  });

  it('supports save, list, get, and delete snapshot routes', async () => {
    const saveResponse = await savePost(new Request('http://localhost/api/save-recipe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipeState: {
          ingredients: ['chicken'],
          notesRaw: '',
          mode: 'hybrid',
          parsedConstraints: { methodTags: [], dietTags: [], flavorTags: [], exclusions: [] },
        },
        recommendation: {
          id: 'recipe-1',
          title: 'Recipe 1',
          summary: 'One',
          rationale: 'First',
          totalMinutes: 15,
          availableIngredientsUsed: ['chicken'],
          availableIngredientsUnused: [],
          extraIngredients: [],
          steps: ['Cook.'],
        },
      }),
    }));
    const listResponse = await listSavedGet();
    const getResponse = await getSavedGet(new Request('http://localhost/api/saved-recipes/saved-1'), {
      params: Promise.resolve({ id: 'saved-1' }),
    });
    const deleteResponse = await deleteSavedDelete(new Request('http://localhost/api/saved-recipes/saved-1', {
      method: 'DELETE',
    }), {
      params: Promise.resolve({ id: 'saved-1' }),
    });

    await expect(saveResponse.json()).resolves.toMatchObject({ snapshot: { id: 'saved-1' } });
    await expect(listResponse.json()).resolves.toMatchObject({ snapshots: [{ id: 'saved-1' }] });
    await expect(getResponse.json()).resolves.toMatchObject({ snapshot: { id: 'saved-1' } });
    await expect(deleteResponse.json()).resolves.toEqual({ deleted: true });
  });
});
