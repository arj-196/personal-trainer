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
