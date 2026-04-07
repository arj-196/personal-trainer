import type { ParsedConstraints, RecipeMode, RecipeState } from './types';

const TOKEN_PATTERN = /[a-z0-9]+/g;

const INGREDIENT_ALIASES: Record<string, string> = {
  potatoes: 'potato',
  onions: 'onion',
  tomatoes: 'tomato',
  chillies: 'chili',
  chilies: 'chili',
  yoghurt: 'yogurt',
  courgette: 'zucchini',
  aubergine: 'eggplant',
};

const METHOD_TAGS = ['air fried', 'air fryer', 'baked', 'roasted', 'grilled', 'pan fried', 'stir fry'];
const DIET_TAGS = ['high protein', 'vegetarian', 'vegan', 'gluten free', 'dairy free', 'low carb'];
const FLAVOR_TAGS = ['spicy', 'savory', 'fresh', 'crispy', 'comforting', 'smoky'];

export function createEmptyRecipeState(): RecipeState {
  return createRecipeState({});
}

export function createRecipeState(partial: Partial<RecipeState>): RecipeState {
  const notesRaw = partial.notesRaw?.trim() ?? '';
  const ingredients = normalizeIngredientList(partial.ingredients ?? []);
  return {
    ingredients,
    notesRaw,
    mode: partial.mode ?? 'hybrid',
    parsedConstraints: parseNotes(notesRaw),
  };
}

export function normalizeIngredient(value: string): string {
  const normalized = (value.toLowerCase().match(TOKEN_PATTERN) || []).join(' ').replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '';
  }

  const canonical = INGREDIENT_ALIASES[normalized] ?? normalized;
  if (canonical.endsWith('es') && canonical.length > 4) {
    const singular = canonical.slice(0, -2);
    if (singular === 'tomato' || singular === 'potato') {
      return singular;
    }
  }
  if (canonical.endsWith('s') && canonical.length > 3 && !canonical.endsWith('ss')) {
    return canonical.slice(0, -1);
  }
  return canonical;
}

export function normalizeIngredientList(values: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  values.forEach((value) => {
    const ingredient = normalizeIngredient(value);
    if (ingredient && !seen.has(ingredient)) {
      seen.add(ingredient);
      normalized.push(ingredient);
    }
  });

  return normalized;
}

export function parseIngredientText(raw: string): string[] {
  return normalizeIngredientList(raw.split(/[\n,;/]+/));
}

export function ingredientTextFromList(values: string[]): string {
  return values.join(', ');
}

export function parseNotes(notesRaw: string): ParsedConstraints {
  const normalized = notesRaw.toLowerCase();
  const maxMinutesMatch = normalized.match(/(?:under|within|less than)\s+(\d+)\s*minutes?/);
  const maxMinutes = maxMinutesMatch ? Number.parseInt(maxMinutesMatch[1] ?? '', 10) : undefined;

  const exclusions = Array.from(
    normalized.matchAll(/(?:without|no|exclude|remove)\s+([a-z][a-z\s-]+)/g),
    (match) => normalizeIngredient(match[1] ?? '')
  ).filter(Boolean);

  return {
    maxMinutes,
    methodTags: collectTags(normalized, METHOD_TAGS),
    dietTags: collectTags(normalized, DIET_TAGS),
    flavorTags: collectTags(normalized, FLAVOR_TAGS),
    exclusions: normalizeIngredientList(exclusions),
  };
}

function collectTags(notesRaw: string, tags: string[]): string[] {
  return tags.filter((tag) => notesRaw.includes(tag));
}

export function applyRecipeStatePatch(state: RecipeState, patch: Partial<RecipeState>): RecipeState {
  const ingredients = patch.ingredients ? normalizeIngredientList(patch.ingredients) : state.ingredients;
  const notesRaw = patch.notesRaw !== undefined ? patch.notesRaw.trim() : state.notesRaw;
  const mode = patch.mode ?? state.mode;

  return {
    ingredients,
    notesRaw,
    mode,
    parsedConstraints: parseNotes(notesRaw),
  };
}

export function recipeStatesEqual(left: RecipeState | null, right: RecipeState | null): boolean {
  if (left === right) {
    return true;
  }
  if (!left || !right) {
    return false;
  }

  return JSON.stringify(sortRecipeState(left)) === JSON.stringify(sortRecipeState(right));
}

function sortRecipeState(state: RecipeState): RecipeState {
  return {
    ...state,
    ingredients: [...state.ingredients].sort(),
    parsedConstraints: {
      maxMinutes: state.parsedConstraints.maxMinutes,
      methodTags: [...state.parsedConstraints.methodTags].sort(),
      dietTags: [...state.parsedConstraints.dietTags].sort(),
      flavorTags: [...state.parsedConstraints.flavorTags].sort(),
      exclusions: [...state.parsedConstraints.exclusions].sort(),
    },
  };
}

export function isRecipeMode(value: string): value is RecipeMode {
  return value === 'strict' || value === 'hybrid' || value === 'anything';
}
