import { NextResponse } from 'next/server';

import { logger } from '@/lib/server/logger';
import { deleteRecipeSnapshot, getRecipeSnapshot } from '@/lib/server/recipes-db';

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const snapshot = await getRecipeSnapshot(id);
    if (!snapshot) {
      return NextResponse.json({ error: 'Saved recipe not found.' }, { status: 404 });
    }
    return NextResponse.json({ snapshot });
  } catch (error) {
    logger.error('Saved recipe fetch failed', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not read saved recipe.' },
      { status: 500 }
    );
  }
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const deleted = await deleteRecipeSnapshot(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Saved recipe not found.' }, { status: 404 });
    }
    return NextResponse.json({ deleted: true });
  } catch (error) {
    logger.error('Saved recipe delete failed', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not delete saved recipe.' },
      { status: 500 }
    );
  }
}
