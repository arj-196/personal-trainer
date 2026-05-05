export type TrainerDataSource = 'local' | 'blob';
export type BlobAccess = 'public' | 'private';

const DEFAULT_BLOB_PREFIX = 'personal-trainer';

export function getTrainerDataSource(): TrainerDataSource {
  return process.env.TRAINER_DATA_SOURCE === 'blob' ? 'blob' : 'local';
}

export function getBlobAccess(): BlobAccess {
  return process.env.TRAINER_BLOB_ACCESS === 'public' ? 'public' : 'private';
}

export function getBlobPrefix(): string {
  const raw = process.env.TRAINER_BLOB_PREFIX?.trim() ?? DEFAULT_BLOB_PREFIX;
  return raw.replace(/^\/+|\/+$/g, '');
}

export function blobPath(...parts: Array<string | null | undefined>): string {
  const prefix = getBlobPrefix();
  const normalizedParts = parts
    .filter((part): part is string => Boolean(part))
    .map((part) => part.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean);

  return [prefix, ...normalizedParts].filter(Boolean).join('/');
}
