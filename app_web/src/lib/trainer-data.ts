import {
  normalizeWorkoutPlan,
  type UserProfileSummary,
  type WorkoutPlan,
} from '@personal-trainer/shared/workout';

import {
  listWorkspaces as listWorkspaceRows,
  readWorkoutPlan as readWorkoutPlanRow,
  readUserProfileSummary as readUserProfileSummaryRow,
} from './server/workspaces';

export type {
  UserProfileSummary,
  WorkoutDay,
  WorkoutExercise,
  WorkoutPlan,
} from '@personal-trainer/shared/workout';

export async function listWorkspaces(): Promise<string[]> {
  return listWorkspaceRows();
}

export async function readWorkoutPlan(workspace: string): Promise<WorkoutPlan | null> {
  const plan = await readWorkoutPlanRow(workspace);
  return plan ? normalizeWorkoutPlan(plan as Record<string, unknown>) : null;
}

export async function readUserProfileSummary(workspace: string): Promise<UserProfileSummary | null> {
  return readUserProfileSummaryRow(workspace);
}

export function workspaceImageUrl(workspace: string, relativePath: string | null): string | null {
  if (!relativePath) {
    return null;
  }
  const encodedParts = relativePath.split('/').map(encodeURIComponent).join('/');
  return `/api/workspace-images/${encodeURIComponent(workspace)}/${encodedParts}`;
}
