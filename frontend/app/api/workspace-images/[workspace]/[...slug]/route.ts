import { NextResponse } from 'next/server';

import { readWorkspaceAsset } from '@/lib/file-routes';

export async function GET(
  _: Request,
  context: { params: Promise<{ workspace: string; slug: string[] }> }
) {
  const { workspace, slug } = await context.params;
  const file = readWorkspaceAsset(workspace, slug);

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
