export type RecipeMode = 'strict' | 'hybrid' | 'anything';

export type ParsedConstraints = {
  maxMinutes?: number;
  methodTags: string[];
  dietTags: string[];
  flavorTags: string[];
  exclusions: string[];
};

export type RecipeState = {
  ingredients: string[];
  notesRaw: string;
  mode: RecipeMode;
  parsedConstraints: ParsedConstraints;
};

export type RecipeWorkspaceState = {
  draft: RecipeState;
  committed: RecipeState | null;
  hasPendingChanges: boolean;
};

export type Recommendation = {
  id: string;
  title: string;
  summary: string;
  rationale: string;
  totalMinutes?: number;
  availableIngredientsUsed: string[];
  availableIngredientsUnused: string[];
  extraIngredients: string[];
  steps: string[];
};

export type SavedRecipeSnapshot = {
  id: string;
  savedAt: string;
  recipeState: RecipeState;
  recommendation: Recommendation;
};

export type InterpretedUtterance = {
  transcript: string;
  intent: string;
  statePatch: Partial<RecipeState>;
  explanation?: string;
  updatedDraft: RecipeState;
};

export type ValidationResult = {
  ok: boolean;
  recommendations: Recommendation[];
  errors: string[];
};

export const HYBRID_PANTRY_EXTRAS = [
  'salt',
  'pepper',
  'oil',
  'butter',
  'vinegar',
  'soy sauce',
  'dried chili flakes',
  'paprika',
  'cumin',
  'dried herbs',
  'mustard',
] as const;

const TOKEN_PATTERN = /[a-z0-9]+/g;
const DEFAULT_AUDIO_MIME_TYPE = 'audio/webm';
const DEFAULT_AUDIO_EXTENSION = 'webm';

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

export function isRecipeMode(value: string): value is RecipeMode {
  return value === 'strict' || value === 'hybrid' || value === 'anything';
}

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

export function normalizeAudioMimeType(value: string | null | undefined): string {
  if (!value?.trim()) {
    return DEFAULT_AUDIO_MIME_TYPE;
  }

  const normalized = normalizeMimeInput(value);
  if (normalized === 'audio/mp4' || normalized === 'audio/m4a' || normalized === 'audio/x-m4a') {
    return 'audio/mp4';
  }
  if (normalized === 'audio/webm') {
    return 'audio/webm';
  }
  if (normalized === 'audio/wav' || normalized === 'audio/x-wav') {
    return 'audio/wav';
  }
  if (normalized === 'audio/mpeg' || normalized === 'audio/mp3' || normalized === 'audio/x-mp3') {
    return 'audio/mpeg';
  }
  if (normalized === 'audio/ogg' || normalized === 'audio/opus') {
    return 'audio/ogg';
  }

  return normalized.startsWith('audio/') ? normalized : DEFAULT_AUDIO_MIME_TYPE;
}

export function audioFileExtensionForMimeType(value: string | null | undefined): string {
  const mimeType = normalizeAudioMimeType(value);
  if (mimeType === 'audio/mp4') return 'm4a';
  if (mimeType === 'audio/wav') return 'wav';
  if (mimeType === 'audio/mpeg') return 'mp3';
  if (mimeType === 'audio/ogg') return 'ogg';
  if (mimeType === 'audio/webm') return 'webm';
  return DEFAULT_AUDIO_EXTENSION;
}

function collectTags(notesRaw: string, tags: string[]): string[] {
  return tags.filter((tag) => notesRaw.includes(tag));
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

function normalizeMimeInput(value: string): string {
  return value.trim().toLowerCase().split(';')[0];
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'recipe';
}
