import { NextResponse } from 'next/server';

import { transcribeAudio } from '@/lib/recipes/openai';
import { logger } from '@/lib/server/logger';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const audio = formData.get('audio');
    if (!(audio instanceof File)) {
      return NextResponse.json({ error: 'Audio file is required.' }, { status: 400 });
    }

    const transcript = await transcribeAudio(audio);
    return NextResponse.json({ transcript });
  } catch (error) {
    logger.error('Recipe transcription failed', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Transcription failed.' },
      { status: 500 }
    );
  }
}
