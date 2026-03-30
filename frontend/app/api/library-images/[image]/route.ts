import { NextResponse } from 'next/server';

import { readLibraryImage } from '@/lib/file-routes';

export async function GET(
  _: Request,
  context: { params: Promise<{ image: string }> }
) {
  const { image } = await context.params;
  const file = readLibraryImage(image);

  if (!file) {
    return new NextResponse('Not found', { status: 404 });
  }

  return new NextResponse(file.body, {
    headers: {
      'Content-Type': file.contentType,
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
