import { NextResponse } from 'next/server';

import { listRecipeSnapshots } from '@/lib/recipes/blob-store';
import { logger } from '@/lib/server/logger';

export async function GET() {
  try {
    const snapshots = await listRecipeSnapshots();
    return NextResponse.json({ snapshots });
  } catch (error) {
    logger.error('Saved recipe listing failed', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not list saved recipes.' },
      { status: 500 }
    );
  }
}
