import { NextResponse } from 'next/server';

import { createLogger } from '@/lib/server/logger';
import { askWorkoutSessionChat } from '@/lib/server/trainer-api';

const logger = createLogger('app_web.api.workout-session-chat');

export async function POST(request: Request, context: { params: Promise<{ workspace: string }> }) {
  try {
    const { workspace } = await context.params;
    const payload = await request.json() as {
      dayHeading?: unknown;
      question?: unknown;
      history?: unknown;
    };
    const result = await askWorkoutSessionChat(workspace, {
      dayHeading: typeof payload.dayHeading === 'string' ? payload.dayHeading : '',
      question: typeof payload.question === 'string' ? payload.question : '',
      history: Array.isArray(payload.history)
        ? payload.history
            .filter((turn): turn is Record<string, unknown> => turn !== null && typeof turn === 'object')
            .map((turn) => ({
              question: typeof turn.question === 'string' ? turn.question : '',
              arnoldResponse: typeof turn.arnoldResponse === 'string' ? turn.arnoldResponse : '',
            }))
        : [],
    });
    return NextResponse.json(result);
  } catch (error) {
    logger.error('Workout Session chat failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not answer Workout Session chat.' },
      { status: 500 }
    );
  }
}
