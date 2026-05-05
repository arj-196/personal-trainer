import { describe, expect, it } from 'vitest';

import { createRecipeState } from './state';
import { repairRecommendations, validateRecommendations } from './recommendation-validation';
import type { Recommendation } from './types';

const baseRecommendation: Recommendation = {
  id: 'spicy-chicken',
  title: 'Spicy Chicken Bowl',
  summary: 'Fast bowl',
  rationale: 'Uses your chicken and rice.',
  totalMinutes: 18,
  availableIngredientsUsed: ['chicken', 'rice'],
  availableIngredientsUnused: [],
  extraIngredients: ['salt'],
  steps: ['Cook the chicken.', 'Serve over rice.'],
};

describe('recommendation validation', () => {
  it('recomputes used, unused, and extra ingredient sets', () => {
    const state = createRecipeState({
      ingredients: ['chicken', 'rice', 'broccoli'],
      notesRaw: '',
      mode: 'hybrid',
    });
    const repaired = repairRecommendations([
      { ...baseRecommendation, availableIngredientsUnused: [], extraIngredients: ['salt', 'broccoli'] },
      { ...baseRecommendation, id: '2', title: 'Recipe 2' },
      { ...baseRecommendation, id: '3', title: 'Recipe 3' },
    ], state);

    expect(repaired[0].availableIngredientsUnused).toEqual(['broccoli']);
    expect(repaired[0].extraIngredients).toEqual(['salt']);
  });

  it('rejects strict mode recipes with extras', () => {
    const state = createRecipeState({
      ingredients: ['chicken', 'rice'],
      notesRaw: '',
      mode: 'strict',
    });
    const result = validateRecommendations([
      baseRecommendation,
      { ...baseRecommendation, id: '2', title: 'Recipe 2' },
      { ...baseRecommendation, id: '3', title: 'Recipe 3' },
    ], state);

    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain('strict mode');
  });

  it('rejects recipes that exceed max minutes', () => {
    const state = createRecipeState({
      ingredients: ['chicken'],
      notesRaw: 'under 10 minutes',
      mode: 'anything',
    });
    const result = validateRecommendations([
      { ...baseRecommendation, totalMinutes: 22, extraIngredients: [] },
      { ...baseRecommendation, id: '2', title: 'Recipe 2', totalMinutes: 9, extraIngredients: [] },
      { ...baseRecommendation, id: '3', title: 'Recipe 3', totalMinutes: 9, extraIngredients: [] },
    ], state);

    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.includes('max minutes'))).toBe(true);
  });
});
