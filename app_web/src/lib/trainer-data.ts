import {
  normalizeWorkoutPlan,
  type UserProfileSummary,
  type WorkoutPlan,
} from '@personal-trainer/shared/workout';

import { blobPath, getTrainerDataSource } from './storage-config';
import { listBlobFolders, readBlobText } from './blob-storage';
import { listLocalWorkspaces, readLocalWorkspaceText } from './local-storage';

export type {
  UserProfileSummary,
  WorkoutDay,
  WorkoutExercise,
  WorkoutPlan,
} from '@personal-trainer/shared/workout';

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

  return normalizeWorkoutPlan(JSON.parse(text) as Record<string, unknown>);
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
