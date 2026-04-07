import { HYBRID_PANTRY_EXTRAS } from './pantry-extras';
import { normalizeIngredient, normalizeIngredientList } from './state';
import type { Recommendation, RecipeState } from './types';

export type ValidationResult = {
  ok: boolean;
  recommendations: Recommendation[];
  errors: string[];
};

export function repairRecommendations(recommendations: Recommendation[], state: RecipeState): Recommendation[] {
  return recommendations.map((recommendation) => normalizeRecommendation(recommendation, state));
}

export function validateRecommendations(recommendations: Recommendation[], state: RecipeState): ValidationResult {
  const normalized = recommendations.map((recommendation) => normalizeRecommendation(recommendation, state));
  const errors: string[] = [];

  if (normalized.length !== 3) {
    errors.push(`Expected exactly 3 recommendations, received ${normalized.length}.`);
  }

  normalized.forEach((recommendation, index) => {
    const prefix = `Recommendation ${index + 1}`;
    if (!recommendation.title.trim()) {
      errors.push(`${prefix} is missing a title.`);
    }
    if (recommendation.steps.length === 0) {
      errors.push(`${prefix} has no steps.`);
    }
    if (state.parsedConstraints.maxMinutes && recommendation.totalMinutes && recommendation.totalMinutes > state.parsedConstraints.maxMinutes) {
      errors.push(`${prefix} exceeds the max minutes constraint.`);
    }

    const extraSet = new Set(recommendation.extraIngredients.map(normalizeIngredient).filter(Boolean));
    const exclusionSet = new Set(state.parsedConstraints.exclusions);

    exclusionSet.forEach((item) => {
      if (extraSet.has(item)) {
        errors.push(`${prefix} includes excluded extra ingredient "${item}".`);
      }
      if (recommendation.availableIngredientsUsed.includes(item)) {
        errors.push(`${prefix} uses excluded ingredient "${item}".`);
      }
    });

    if (state.mode === 'strict' && recommendation.extraIngredients.length > 0) {
      errors.push(`${prefix} violates strict mode by adding extra ingredients.`);
    }
    if (state.mode === 'hybrid') {
      const allowedExtras = new Set(HYBRID_PANTRY_EXTRAS.map(normalizeIngredient));
      recommendation.extraIngredients.forEach((item) => {
        if (!allowedExtras.has(normalizeIngredient(item))) {
          errors.push(`${prefix} uses non-hybrid extra ingredient "${item}".`);
        }
      });
    }
  });

  return {
    ok: errors.length === 0,
    recommendations: normalized.slice(0, 3),
    errors,
  };
}

function normalizeRecommendation(recommendation: Recommendation, state: RecipeState): Recommendation {
  const available = normalizeIngredientList(state.ingredients);
  const availableSet = new Set(available);
  const used = normalizeIngredientList(recommendation.availableIngredientsUsed).filter((item) => availableSet.has(item));
  const usedSet = new Set(used);
  const unused = available.filter((item) => !usedSet.has(item));
  const extra = normalizeIngredientList(recommendation.extraIngredients)
    .filter((item) => !availableSet.has(item))
    .filter((item) => !state.parsedConstraints.exclusions.includes(item));

  return {
    ...recommendation,
    id: recommendation.id || slugify(recommendation.title),
    title: recommendation.title.trim(),
    summary: recommendation.summary.trim(),
    rationale: recommendation.rationale.trim(),
    totalMinutes: recommendation.totalMinutes,
    availableIngredientsUsed: used,
    availableIngredientsUnused: unused,
    extraIngredients: extra,
    steps: recommendation.steps.map((step) => step.trim()).filter(Boolean),
  };
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'recipe';
}
