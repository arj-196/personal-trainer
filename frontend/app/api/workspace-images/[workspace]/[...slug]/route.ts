import { NextResponse } from 'next/server';

import { readWorkspaceAsset } from '@/lib/file-routes';

export const dynamic = 'force-dynamic';

export async function GET(
  _: Request,
  context: { params: Promise<{ workspace: string; slug: string[] }> }
) {
  const { workspace, slug } = await context.params;
  const file = await readWorkspaceAsset(workspace, slug);

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
