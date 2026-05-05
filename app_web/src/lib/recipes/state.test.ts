import { describe, expect, it } from 'vitest';

import {
  applyRecipeStatePatch,
  createEmptyRecipeState,
  parseIngredientText,
  parseNotes,
  recipeStatesEqual,
} from './state';

describe('recipe state helpers', () => {
  it('normalizes and deduplicates ingredients', () => {
    expect(parseIngredientText('Potatoes, onions\nOnions; tomatoes')).toEqual([
      'potato',
      'onion',
      'tomato',
    ]);
  });

  it('parses notes into structured constraints', () => {
    expect(parseNotes('Air fried, high protein, spicy, under 20 minutes, no onions')).toEqual({
      maxMinutes: 20,
      methodTags: ['air fried'],
      dietTags: ['high protein'],
      flavorTags: ['spicy'],
      exclusions: ['onion'],
    });
  });

  it('applies recipe state patches and reparses notes', () => {
    const state = createEmptyRecipeState();
    const next = applyRecipeStatePatch(state, {
      ingredients: ['chicken', 'rice'],
      notesRaw: 'under 15 minutes',
      mode: 'strict',
    });

    expect(next.ingredients).toEqual(['chicken', 'rice']);
    expect(next.mode).toBe('strict');
    expect(next.parsedConstraints.maxMinutes).toBe(15);
  });

  it('compares states by normalized content', () => {
    const left = applyRecipeStatePatch(createEmptyRecipeState(), {
      ingredients: ['rice', 'chicken'],
      notesRaw: 'spicy',
    });
    const right = applyRecipeStatePatch(createEmptyRecipeState(), {
      ingredients: ['chicken', 'rice'],
      notesRaw: 'spicy',
    });

    expect(recipeStatesEqual(left, right)).toBe(true);
  });
});
