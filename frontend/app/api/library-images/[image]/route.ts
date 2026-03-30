import { NextResponse } from 'next/server';

import { readLibraryImage } from '@/lib/file-routes';

export const dynamic = 'force-dynamic';

export async function GET(
  _: Request,
  context: { params: Promise<{ image: string }> }
) {
  const { image } = await context.params;
  const file = await readLibraryImage(image);

  if (!file) {
    return new NextResponse('Not found', { status: 404 });
  }

  return new NextResponse(new Uint8Array(file.body), {
    headers: {
      'Content-Type': file.contentType,
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
