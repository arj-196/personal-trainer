import { HYBRID_PANTRY_EXTRAS } from './pantry-extras';
import { chatJson } from './openai';
import { applyRecipeStatePatch } from './state';
import type { InterpretedUtterance, Recommendation, RecipeState } from './types';

const interpretationSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['intent', 'statePatch', 'explanation'],
  properties: {
    intent: { type: 'string' },
    explanation: { type: 'string' },
    statePatch: {
      type: 'object',
      additionalProperties: false,
      required: ['ingredients', 'notesRaw', 'mode'],
      properties: {
        ingredients: { type: ['array', 'null'], items: { type: 'string' } },
        notesRaw: { type: ['string', 'null'] },
        mode: { type: ['string', 'null'], enum: ['strict', 'hybrid', 'anything', null] },
      },
    },
  },
} as const;

const recommendationSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['recommendations'],
  properties: {
    recommendations: {
      type: 'array',
      minItems: 3,
      maxItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'title', 'summary', 'rationale', 'totalMinutes', 'availableIngredientsUsed', 'availableIngredientsUnused', 'extraIngredients', 'steps'],
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          summary: { type: 'string' },
          rationale: { type: 'string' },
          totalMinutes: { type: 'number' },
          availableIngredientsUsed: { type: 'array', items: { type: 'string' } },
          availableIngredientsUnused: { type: 'array', items: { type: 'string' } },
          extraIngredients: { type: 'array', items: { type: 'string' } },
          steps: { type: 'array', minItems: 1, items: { type: 'string' } },
        },
      },
    },
  },
} as const;

export async function interpretUtterance(transcript: string, draft: RecipeState): Promise<InterpretedUtterance> {
  const payload = await chatJson<{
    intent: string;
    statePatch: {
      ingredients: string[] | null;
      notesRaw: string | null;
      mode: RecipeState['mode'] | null;
    };
    explanation: string;
  }>(
    'You interpret recipe workspace transcripts into explicit state patches. Return only state changes that should update the recipe draft.',
    [
      `Transcript: ${transcript}`,
      `Current draft: ${JSON.stringify(draft)}`,
      'If the user mentions a mode, set mode to strict, hybrid, or anything.',
      'Use notesRaw for freeform preferences and constraints.',
      'Use ingredients only for available ingredients.',
    ].join('\n'),
    interpretationSchema
  );

  const statePatch: Partial<RecipeState> = {};
  if (payload.statePatch.ingredients !== null) {
    statePatch.ingredients = payload.statePatch.ingredients;
  }
  if (payload.statePatch.notesRaw !== null) {
    statePatch.notesRaw = payload.statePatch.notesRaw;
  }
  if (payload.statePatch.mode !== null) {
    statePatch.mode = payload.statePatch.mode;
  }

  return {
    transcript,
    intent: payload.intent,
    statePatch,
    explanation: payload.explanation,
    updatedDraft: applyRecipeStatePatch(draft, statePatch),
  };
}

export async function generateRecommendations(state: RecipeState): Promise<Recommendation[]> {
  const payload = await chatJson<{ recommendations: Recommendation[] }>(
    'You generate exactly three recipe recommendations for a state-driven recipe workspace. Use a sensible subset of the available ingredients and keep the response practical and concise.',
    [
      `Recipe state: ${JSON.stringify(state)}`,
      `Hybrid pantry extras: ${HYBRID_PANTRY_EXTRAS.join(', ')}`,
      'Strict mode allows no extra ingredients.',
      'Hybrid mode only allows extra ingredients from the hybrid pantry extras list.',
      'Anything mode may introduce extra ingredients freely.',
      'Return exactly 3 options.',
    ].join('\n'),
    recommendationSchema
  );

  return payload.recommendations;
}
