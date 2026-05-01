import { describe, expect, it } from 'vitest';

import {
  audioFileExtensionForMimeType,
  createRecipeState,
  normalizeIngredientList,
  parseIngredientText,
  repairRecommendations,
  validateRecommendations,
} from './recipes';
import type { Recommendation } from './recipes';

describe('recipe state helpers', () => {
  it('normalizes ingredients and parses notes constraints', () => {
    const state = createRecipeState({
      ingredients: parseIngredientText('Potatoes, tomatoes; chicken'),
      notesRaw: 'high protein, under 20 minutes, no onions',
    });

    expect(state.ingredients).toEqual(['potato', 'tomato', 'chicken']);
    expect(state.parsedConstraints.maxMinutes).toBe(20);
    expect(state.parsedConstraints.dietTags).toContain('high protein');
    expect(state.parsedConstraints.exclusions).toEqual(['onion']);
  });

  it('deduplicates normalized ingredient lists', () => {
    expect(normalizeIngredientList(['Potatoes', 'potato', 'Chillies'])).toEqual(['potato', 'chili']);
  });
});

describe('recommendation validation', () => {
  const baseRecommendation: Recommendation = {
    id: 'one',
    title: 'Simple bowl',
    summary: 'A bowl.',
    rationale: 'Uses available ingredients.',
    totalMinutes: 15,
    availableIngredientsUsed: ['chicken'],
    availableIngredientsUnused: [],
    extraIngredients: ['salt'],
    steps: ['Cook.'],
  };

  it('repairs and validates three hybrid recommendations', () => {
    const state = createRecipeState({ ingredients: ['chicken', 'potato'], mode: 'hybrid' });
    const recommendations = repairRecommendations([
      baseRecommendation,
      { ...baseRecommendation, id: 'two', title: 'Second' },
      { ...baseRecommendation, id: 'three', title: 'Third' },
    ], state);

    expect(validateRecommendations(recommendations, state)).toMatchObject({ ok: true, errors: [] });
  });

  it('rejects non-pantry extras in hybrid mode', () => {
    const state = createRecipeState({ ingredients: ['chicken'], mode: 'hybrid' });
    const invalid = [
      { ...baseRecommendation, extraIngredients: ['truffle'] },
      { ...baseRecommendation, id: 'two', title: 'Second' },
      { ...baseRecommendation, id: 'three', title: 'Third' },
    ];

    expect(validateRecommendations(invalid, state).errors).toContain(
      'Recommendation 1 uses non-hybrid extra ingredient "truffle".'
    );
  });
});

describe('audio helpers', () => {
  it('maps iPhone audio MIME values to m4a files', () => {
    expect(audioFileExtensionForMimeType('audio/mp4; codecs=mp4a')).toBe('m4a');
  });
});
