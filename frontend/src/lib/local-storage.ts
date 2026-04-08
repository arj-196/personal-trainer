import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { contentTypeFor } from './content-types';

const REPO_ROOT = resolve(process.cwd(), '..');
const WORKSPACES_DIR = join(REPO_ROOT, 'workspaces');

export type StoredFile = {
  body: Buffer;
  contentType: string;
};

export function listLocalWorkspaces(): string[] {
  if (!existsSync(WORKSPACES_DIR)) {
    return [];
  }

  return readdirSync(WORKSPACES_DIR)
    .filter((entry) => {
      const fullPath = join(WORKSPACES_DIR, entry);
      return statSync(fullPath).isDirectory() && existsSync(join(fullPath, 'profile.json'));
    })
    .sort();
}

export function readLocalWorkspaceText(workspace: string, filename: string): string | null {
  const targetPath = join(WORKSPACES_DIR, workspace, filename);
  return existsSync(targetPath) ? readFileSync(targetPath, 'utf-8') : null;
}

export function readLocalWorkspaceAsset(workspace: string, pathParts: string[]): StoredFile | null {
  return readLocalFile(join(WORKSPACES_DIR, workspace, ...pathParts));
}

function readLocalFile(targetPath: string): StoredFile | null {
  if (!existsSync(targetPath)) {
    return null;
  }

  return {
    body: readFileSync(targetPath),
    contentType: contentTypeFor(targetPath),
  };
}
