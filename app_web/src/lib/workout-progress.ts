import {
  normalizeCompletedWorkoutIds,
  toggleWorkoutBlock,
  workoutProgressKey,
} from '@personal-trainer/shared/workout';

export function readWorkoutProgress(workspace: string, dayHeading: string): string[] {
  if (typeof window === 'undefined' || !window.localStorage) {
    return [];
  }

  const rawValue = window.localStorage.getItem(workoutProgressKey(workspace, dayHeading));
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);
    return normalizeCompletedWorkoutIds(parsed);
  } catch {
    return [];
  }
}

export function writeWorkoutProgress(workspace: string, dayHeading: string, completedIds: string[]): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  window.localStorage.setItem(workoutProgressKey(workspace, dayHeading), JSON.stringify(completedIds));
}

export { toggleWorkoutBlock };
