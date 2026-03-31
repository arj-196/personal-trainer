import { describe, expect, it } from 'vitest';

import { inferGoalBucket, parsePantryItems, recommendRecipes } from './recipe-data';
import type { RecipeCatalogEntry, UserProfileSummary } from './trainer-data';

const profile: UserProfileSummary = {
  name: 'Jordan',
  goal: 'Build muscle',
};

const catalog: RecipeCatalogEntry[] = [
  {
    slug: 'chicken-rice-broccoli-bowl',
    title: 'Chicken, Rice, and Broccoli Bowl',
    summary: 'Protein-forward bowl',
    meal_type: 'lunch',
    goal_tags: ['muscle gain', 'maintenance'],
    ingredients_required: ['chicken', 'rice', 'broccoli'],
    ingredients_optional: ['garlic'],
    substitutions: ['Swap chicken for tofu.'],
    estimated_prep_minutes: 10,
    estimated_cook_minutes: 18,
    instructions: ['Cook the rice.'],
    nutrition_summary: 'Protein-forward',
    confidence_note: 'Strong fit',
  },
  {
    slug: 'egg-veggie-skillet',
    title: 'Egg and Veggie Skillet',
    summary: 'Egg skillet',
    meal_type: 'breakfast',
    goal_tags: ['fat loss', 'maintenance'],
    ingredients_required: ['eggs', 'spinach'],
    ingredients_optional: ['tomato'],
    substitutions: ['Swap spinach for kale.'],
    estimated_prep_minutes: 8,
    estimated_cook_minutes: 8,
    instructions: ['Cook gently.'],
    nutrition_summary: 'Lighter meal',
    confidence_note: 'Good fit',
  },
];

describe('parsePantryItems', () => {
  it('normalizes and deduplicates pantry input', () => {
    expect(parsePantryItems('Chicken breast, rice\nBroccoli; broccoli')).toEqual([
      'chicken',
      'rice',
      'broccoli',
    ]);
  });
});

describe('inferGoalBucket', () => {
  it('maps user goals into supported goal buckets', () => {
    expect(inferGoalBucket('Lose fat while keeping muscle')).toBe('fat loss');
    expect(inferGoalBucket('Build muscle')).toBe('muscle gain');
  });
});

describe('recommendRecipes', () => {
  it('ranks the best pantry and goal match first', () => {
    const suggestions = recommendRecipes(profile, catalog, ['chicken', 'rice', 'broccoli', 'garlic']);

    expect(suggestions[0]).toMatchObject({
      title: 'Chicken, Rice, and Broccoli Bowl',
      fitLabel: 'strong fit',
      missingIngredients: [],
    });
  });

  it('supports goal overrides', () => {
    const suggestions = recommendRecipes(profile, catalog, ['egg', 'spinach', 'tomato'], 'Fat loss');

    expect(suggestions[0].title).toBe('Egg and Veggie Skillet');
  });
});
