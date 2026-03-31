import type { RecipeCatalogEntry, UserProfileSummary } from './trainer-data';

const TOKEN_PATTERN = /[a-z0-9]+/g;

const INGREDIENT_ALIASES: Record<string, string> = {
  'chicken breast': 'chicken',
  'chicken thighs': 'chicken',
  'brown rice': 'rice',
  'white rice': 'rice',
  'frozen broccoli': 'broccoli',
  'broccoli florets': 'broccoli',
  'black beans': 'beans',
  'kidney beans': 'beans',
  'chopped tomatoes': 'tomato',
  'canned tomatoes': 'tomato',
  'baby spinach': 'spinach',
  'plain greek yogurt': 'greek yogurt',
  'whey protein': 'protein powder',
};

export type RecipeSuggestion = {
  title: string;
  summary: string;
  goalFitReason: string;
  fitLabel: string;
  pantryIngredientsUsed: string[];
  missingIngredients: string[];
  optionalIngredients: string[];
  estimatedPrepMinutes: number;
  estimatedCookMinutes: number;
  instructions: string[];
  substitutions: string[];
  nutritionSummary: string;
  confidenceNote: string;
  score: number;
};

export function parsePantryItems(raw: string): string[] {
  const candidates = raw.split(/[\n,;/]+/);
  const seen = new Set<string>();
  const pantry: string[] = [];

  candidates.forEach((candidate) => {
    const normalized = normalizeIngredient(candidate);
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      pantry.push(normalized);
    }
  });

  return pantry;
}

export function inferGoalBucket(goal: string): string {
  const normalized = normalizeIngredient(goal);
  if (normalized.includes('fat loss') || normalized.includes('lose fat') || normalized.includes('cut') || normalized.includes('lean')) {
    return 'fat loss';
  }
  if (normalized.includes('muscle') || normalized.includes('bulk') || normalized.includes('gain') || normalized.includes('hypertrophy')) {
    return 'muscle gain';
  }
  if (normalized.includes('recovery') || normalized.includes('post workout') || normalized.includes('postworkout')) {
    return 'faster post-workout recovery';
  }
  if (normalized.includes('protein')) {
    return 'higher protein intake';
  }
  return 'maintenance';
}

export function recommendRecipes(
  profile: UserProfileSummary | null,
  recipes: RecipeCatalogEntry[],
  pantryItems: string[],
  goalOverride?: string
): RecipeSuggestion[] {
  const pantry = new Set(pantryItems.map(normalizeIngredient).filter(Boolean));
  if (pantry.size === 0) {
    return [];
  }

  const goalBucket = inferGoalBucket(goalOverride?.trim() || profile?.goal || 'maintenance');
  const suggestions = recipes
    .map((recipe) => {
      const required = recipe.ingredients_required.map(normalizeIngredient);
      const optional = recipe.ingredients_optional.map(normalizeIngredient);
      const used = required.filter((ingredient) => pantry.has(ingredient));
      const missing = required.filter((ingredient) => !pantry.has(ingredient));
      const optionalUsed = optional.filter((ingredient) => pantry.has(ingredient));

      if (used.length === 0) {
        return null;
      }

      const coverage = used.length / required.length;
      const goalScore = goalMatchScore(goalBucket, recipe.goal_tags);
      const score = goalScore + (coverage * 3) + Math.min(optionalUsed.length, 2) * 0.15 - (missing.length * 0.75);

      return {
        title: recipe.title,
        summary: recipe.summary,
        goalFitReason: goalFitReason(goalBucket, recipe.goal_tags, coverage, missing),
        fitLabel: fitLabel(goalScore, coverage, missing),
        pantryIngredientsUsed: [...used, ...optionalUsed.filter((ingredient) => !used.includes(ingredient))],
        missingIngredients: missing,
        optionalIngredients: optional.filter((ingredient) => !optionalUsed.includes(ingredient)),
        estimatedPrepMinutes: recipe.estimated_prep_minutes,
        estimatedCookMinutes: recipe.estimated_cook_minutes,
        instructions: recipe.instructions,
        substitutions: recipe.substitutions,
        nutritionSummary: recipe.nutrition_summary,
        confidenceNote: recipe.confidence_note,
        score: Number(score.toFixed(2)),
      } satisfies RecipeSuggestion;
    })
    .filter((item): item is RecipeSuggestion => item !== null)
    .sort((a, b) => b.score - a.score || a.missingIngredients.length - b.missingIngredients.length || a.title.localeCompare(b.title));

  return suggestions.slice(0, 5);
}

function normalizeIngredient(value: string): string {
  const lowered = (value.toLowerCase().match(TOKEN_PATTERN) || []).join(' ').replace(/\s+/g, ' ').trim();
  if (!lowered) {
    return '';
  }

  const canonical = INGREDIENT_ALIASES[lowered] || lowered;
  if (canonical.endsWith('es') && canonical.length > 4) {
    const singular = canonical.slice(0, -2);
    if (singular === 'tomato' || singular === 'potato') {
      return singular;
    }
  }
  if (canonical.endsWith('s') && canonical.length > 3 && !canonical.endsWith('ss')) {
    const singular = canonical.slice(0, -1);
    if (singular !== 'bean' && singular !== 'oat') {
      return singular;
    }
  }
  return canonical;
}

function goalMatchScore(goalBucket: string, goalTags: string[]): number {
  const normalizedTags = new Set(goalTags.map((tag) => normalizeIngredient(tag)));
  if (normalizedTags.has(normalizeIngredient(goalBucket))) {
    return 3;
  }
  if (goalBucket === 'higher protein intake' && goalTags.includes('muscle gain')) {
    return 2.5;
  }
  if (goalBucket === 'maintenance') {
    return 2;
  }
  return 1;
}

function goalFitReason(goalBucket: string, goalTags: string[], coverage: number, missing: string[]): string {
  const coveragePct = Math.round(coverage * 100);
  const normalizedTags = new Set(goalTags.map((tag) => normalizeIngredient(tag)));

  if (normalizedTags.has(normalizeIngredient(goalBucket))) {
    if (missing.length === 0) {
      return `Strong goal match with full pantry coverage and ${coveragePct}% of required ingredients already available.`;
    }
    return `Strong goal match that still uses ${coveragePct}% of the required ingredients you already have.`;
  }

  if (missing.length === 0) {
    return 'Good pantry match with full ingredient coverage, even though the goal fit is more general.';
  }

  return `Useful fallback with ${coveragePct}% pantry coverage and a broader fit for ${goalBucket}.`;
}

function fitLabel(goalScore: number, coverage: number, missing: string[]): string {
  if (goalScore >= 3 && coverage >= 0.8 && missing.length === 0) {
    return 'strong fit';
  }
  if (goalScore >= 2 && coverage >= 0.5) {
    return 'decent fit';
  }
  return 'fallback';
}
