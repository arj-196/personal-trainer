import { NextResponse } from 'next/server';

import { createRecipeState } from '@/lib/recipes/state';
import { interpretRecipeUtterance } from '@/lib/recipes/service';
import { logger } from '@/lib/server/logger';

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { transcript?: string; draft?: unknown };
    if (!payload.transcript?.trim()) {
      return NextResponse.json({ error: 'Transcript is required.' }, { status: 400 });
    }

    const draft = createRecipeState((payload.draft as Record<string, unknown> | undefined) as never);
    const result = await interpretRecipeUtterance(payload.transcript, draft);
    return NextResponse.json({ result });
  } catch (error) {
    logger.error('Recipe interpretation failed', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Interpretation failed.' },
      { status: 500 }
    );
  }
}
