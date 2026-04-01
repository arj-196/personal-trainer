import { blobPath, getTrainerDataSource } from './storage-config';
import { listBlobFolders, readBlobText } from './blob-storage';
import {
  listLocalWorkspaces,
  readLocalExerciseCatalogText,
  readLocalRecipeCatalogText,
  readLocalWorkspaceText,
} from './local-storage';

export type WorkoutExercise = {
  name: string;
  prescription: string;
  notes: string;
  imagePath: string | null;
  referencePath: string | null;
};

export type WorkoutDay = {
  heading: string;
  warmup: string;
  exercises: WorkoutExercise[];
  finisher: string;
  recovery: string;
};

export type WorkoutPlan = {
  title: string;
  meta: Array<{ label: string; value: string }>;
  summary: string;
  progression: string;
  days: WorkoutDay[];
  nextCheckIn: string;
};

export type ExerciseReference = {
  slug: string;
  name: string;
  aliases: string[];
  summary: string;
  setup: string;
  cues: string[];
  visual_note: string;
  image_filename: string;
  source_title: string;
  source_url: string;
  author: string;
  credit: string;
  license: string;
  license_url: string;
};

export type UserProfileSummary = {
  name: string;
  goal: string;
};

export type RecipeCatalogEntry = {
  slug: string;
  title: string;
  summary: string;
  meal_type: string;
  goal_tags: string[];
  ingredients_required: string[];
  ingredients_optional: string[];
  substitutions: string[];
  estimated_prep_minutes: number;
  estimated_cook_minutes: number;
  instructions: string[];
  nutrition_summary: string;
  confidence_note: string;
};

export async function listWorkspaces(): Promise<string[]> {
  if (getTrainerDataSource() === 'blob') {
    const folders = await listBlobFolders(blobPath('workspaces') + '/');
    return folders
      .map((folder) => folder.replace(/\/$/, '').split('/').pop())
      .filter((workspace): workspace is string => Boolean(workspace))
      .sort();
  }

  return listLocalWorkspaces();
}

export async function readWorkoutPlan(workspace: string): Promise<WorkoutPlan | null> {
  const text =
    getTrainerDataSource() === 'blob'
      ? await readBlobText(blobPath('workspaces', workspace, 'plan.json'))
      : readLocalWorkspaceText(workspace, 'plan.json');

  if (!text) {
    return null;
  }

  return JSON.parse(text) as WorkoutPlan;
}

export async function readExerciseLibrary(): Promise<ExerciseReference[]> {
  const text =
    getTrainerDataSource() === 'blob'
      ? await readBlobText(blobPath('exercise-library', 'catalog.json'))
      : readLocalExerciseCatalogText();

  return text ? (JSON.parse(text) as ExerciseReference[]) : [];
}

export async function readRecipeCatalog(): Promise<RecipeCatalogEntry[]> {
  const text =
    getTrainerDataSource() === 'blob'
      ? await readBlobText(blobPath('recipes', 'catalog.json'))
      : readLocalRecipeCatalogText();

  return text ? (JSON.parse(text) as RecipeCatalogEntry[]) : [];
}

export async function readUserProfileSummary(workspace: string): Promise<UserProfileSummary | null> {
  const text =
    getTrainerDataSource() === 'blob'
      ? await readBlobText(blobPath('workspaces', workspace, 'profile.json'))
      : readLocalWorkspaceText(workspace, 'profile.json');

  if (!text) {
    return null;
  }

  const payload = JSON.parse(text) as Partial<UserProfileSummary>;
  return {
    name: payload.name ?? workspace,
    goal: payload.goal ?? 'Maintenance',
  };
}

export function workspaceImageUrl(workspace: string, relativePath: string | null): string | null {
  if (!relativePath) {
    return null;
  }
  const encodedParts = relativePath.split('/').map(encodeURIComponent).join('/');
  return `/api/workspace-images/${encodeURIComponent(workspace)}/${encodedParts}`;
}

export function libraryImageUrl(imageFilename: string): string {
  return `/api/library-images/${encodeURIComponent(imageFilename)}`;
}
