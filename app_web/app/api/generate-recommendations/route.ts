import { NextResponse } from 'next/server';

import { createRecipeState } from '@/lib/recipes/state';
import { generateValidatedRecommendations, RecipeValidationError } from '@/lib/recipes/service';
import { logger } from '@/lib/server/logger';

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { recipeState?: unknown };
    const recipeState = createRecipeState((payload.recipeState as Record<string, unknown> | undefined) as never);
    if (recipeState.ingredients.length === 0) {
      return NextResponse.json({ error: 'At least one ingredient is required.' }, { status: 400 });
    }

    const recommendations = await generateValidatedRecommendations(recipeState);
    return NextResponse.json({ recommendations });
  } catch (error) {
    logger.error('Recipe generation failed', { error: error instanceof Error ? error.message : String(error) });
    if (error instanceof RecipeValidationError) {
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: 422 }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generation failed.' },
      { status: 500 }
    );
  }
}
