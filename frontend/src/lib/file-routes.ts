import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const REPO_ROOT = resolve(process.cwd(), '..');
const WORKSPACES_DIR = join(REPO_ROOT, 'workspaces');
const LIBRARY_IMAGES_DIR = join(
  REPO_ROOT,
  'trainer',
  'src',
  'personal_trainer',
  'assets',
  'exercise_library',
  'images'
);

export function readWorkspaceAsset(workspace: string, pathParts: string[]) {
  const targetPath = join(WORKSPACES_DIR, workspace, ...pathParts);
  return readLocalFile(targetPath);
}

export function readLibraryImage(imageFilename: string) {
  const targetPath = join(LIBRARY_IMAGES_DIR, imageFilename);
  return readLocalFile(targetPath);
}

function readLocalFile(targetPath: string) {
  if (!existsSync(targetPath)) {
    return null;
  }

  const file = readFileSync(targetPath);
  return {
    body: file,
    contentType: contentTypeFor(targetPath),
  };
}

function contentTypeFor(targetPath: string) {
  const lower = targetPath.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  return 'application/octet-stream';
}
