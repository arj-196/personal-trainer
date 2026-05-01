import { get, list } from '@vercel/blob';

import { getBlobAccess } from './storage-config';

export type StoredFile = {
  body: Buffer;
  contentType: string;
};

export async function listBlobFolders(prefix: string): Promise<string[]> {
  const folders = new Set<string>();
  let cursor: string | undefined;

  do {
    const result = await list({
      cursor,
      prefix,
      mode: 'folded',
    });
    result.folders.forEach((folder) => folders.add(folder));
    cursor = result.hasMore ? result.cursor : undefined;
  } while (cursor);

  return Array.from(folders).sort();
}

export async function readBlobText(pathname: string): Promise<string | null> {
  const file = await readBlobFile(pathname);
  if (!file) {
    return null;
  }

  return file.body.toString('utf-8');
}

export async function readBlobFile(pathname: string): Promise<StoredFile | null> {
  const result = await get(pathname, {
    access: getBlobAccess(),
  });

  if (!result || result.statusCode !== 200 || !result.stream) {
    return null;
  }

  const body = Buffer.from(await new Response(result.stream).arrayBuffer());
  return {
    body,
    contentType: result.blob.contentType,
  };
}
