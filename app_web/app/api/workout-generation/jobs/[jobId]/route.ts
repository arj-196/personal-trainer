import { NextResponse } from 'next/server';

import { getWorkoutPlanGeneration } from '@/lib/server/trainer-api';
import { createLogger } from '@/lib/server/logger';

const logger = createLogger('app_web.api.workout-generation.job');

export async function GET(_: Request, context: { params: Promise<{ jobId: string }> }) {
  try {
    const { jobId } = await context.params;
    const result = await getWorkoutPlanGeneration(jobId);
    return NextResponse.json(result);
  } catch (error) {
    logger.error('Workout Plan generation status fetch failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not read Workout Plan generation status.' },
      { status: 500 }
    );
  }
}
