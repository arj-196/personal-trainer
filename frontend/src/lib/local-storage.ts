import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { contentTypeFor } from './content-types';

const REPO_ROOT = resolve(process.cwd(), '..');
const WORKSPACES_DIR = join(REPO_ROOT, 'workspaces');
const EXERCISE_LIBRARY_DIR = join(
  REPO_ROOT,
  'trainer',
  'src',
  'personal_trainer',
  'assets',
  'exercise_library'
);
const EXERCISE_CATALOG = join(EXERCISE_LIBRARY_DIR, 'catalog.json');
const LIBRARY_IMAGES_DIR = join(EXERCISE_LIBRARY_DIR, 'images');
const RECIPE_CATALOG = join(REPO_ROOT, 'trainer', 'src', 'personal_trainer', 'assets', 'recipes', 'catalog.json');

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

export function readLocalExerciseCatalogText(): string | null {
  return existsSync(EXERCISE_CATALOG) ? readFileSync(EXERCISE_CATALOG, 'utf-8') : null;
}

export function readLocalRecipeCatalogText(): string | null {
  return existsSync(RECIPE_CATALOG) ? readFileSync(RECIPE_CATALOG, 'utf-8') : null;
}

export function readLocalWorkspaceAsset(workspace: string, pathParts: string[]): StoredFile | null {
  return readLocalFile(join(WORKSPACES_DIR, workspace, ...pathParts));
}

export function readLocalLibraryImage(imageFilename: string): StoredFile | null {
  return readLocalFile(join(LIBRARY_IMAGES_DIR, imageFilename));
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
