import { NextResponse } from 'next/server';

import { saveRecipeSnapshot } from '@/lib/recipes/blob-store';
import { createRecipeState } from '@/lib/recipes/state';
import { logger } from '@/lib/server/logger';

export async function POST(request: Request) {
  try {
    const payload = await request.json() as {
      recipeState?: unknown;
      recommendation?: Parameters<typeof saveRecipeSnapshot>[1];
    };

    if (!payload.recommendation) {
      return NextResponse.json({ error: 'Recommendation is required.' }, { status: 400 });
    }

    const recipeState = createRecipeState((payload.recipeState as Record<string, unknown> | undefined) as never);
    const snapshot = await saveRecipeSnapshot(recipeState, payload.recommendation);
    return NextResponse.json({ snapshot });
  } catch (error) {
    logger.error('Recipe snapshot save failed', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Save failed.' },
      { status: 500 }
    );
  }
}
