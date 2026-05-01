import { logger } from '@/lib/server/logger';

import { generateRecommendations as generateRecommendationsWithAi, interpretUtterance as interpretUtteranceWithAi } from './ai';
import { repairRecommendations, validateRecommendations } from './recommendation-validation';
import type { InterpretedUtterance, Recommendation, RecipeState } from './types';

export class RecipeValidationError extends Error {
  constructor(message: string, readonly details: string[] = []) {
    super(message);
  }
}

export async function interpretRecipeUtterance(transcript: string, draft: RecipeState): Promise<InterpretedUtterance> {
  return interpretUtteranceWithAi(transcript, draft);
}

export async function generateValidatedRecommendations(state: RecipeState): Promise<Recommendation[]> {
  logger.info('Generating recipe recommendations', { mode: state.mode, ingredientCount: state.ingredients.length });
  const firstPass = await generateRecommendationsWithAi(state);
  const repaired = repairRecommendations(firstPass, state);
  const repairedValidation = validateRecommendations(repaired, state);
  if (repairedValidation.ok) {
    return repairedValidation.recommendations;
  }

  logger.warn('Recipe repair did not fully validate, retrying generation', { errors: repairedValidation.errors });
  const secondPass = await generateRecommendationsWithAi(state);
  const secondValidation = validateRecommendations(repairRecommendations(secondPass, state), state);
  if (secondValidation.ok) {
    return secondValidation.recommendations;
  }

  throw new RecipeValidationError('Could not generate a valid set of recipe recommendations.', secondValidation.errors);
}
