import { NextResponse } from 'next/server';

import { getActiveWorkoutPlanGeneration, startWorkoutPlanGeneration } from '@/lib/server/trainer-api';
import { createLogger } from '@/lib/server/logger';

const logger = createLogger('app_web.api.workout-generation');

export async function GET(_: Request, context: { params: Promise<{ workspace: string }> }) {
  try {
    const { workspace } = await context.params;
    const result = await getActiveWorkoutPlanGeneration(workspace);
    return NextResponse.json(result);
  } catch (error) {
    logger.error('Active Workout Plan generation fetch failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not read active Workout Plan generation.' },
      { status: 500 }
    );
  }
}

export async function POST(_: Request, context: { params: Promise<{ workspace: string }> }) {
  try {
    const { workspace } = await context.params;
    const result = await startWorkoutPlanGeneration(workspace);
    return NextResponse.json(result);
  } catch (error) {
    logger.error('Workout Plan generation start failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not start Workout Plan generation.' },
      { status: 500 }
    );
  }
}
