import {
  normalizeCompletedWorkoutIds,
  toggleWorkoutBlock,
  workoutProgressKey,
  workoutStopwatchVisibilityKey,
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

export function readWorkoutStopwatchVisibility(workspace: string, dayHeading: string): boolean {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false;
  }

  const rawValue = window.localStorage.getItem(workoutStopwatchVisibilityKey(workspace, dayHeading));
  if (rawValue === null) {
    return false;
  }

  return rawValue === 'true';
}

export function writeWorkoutStopwatchVisibility(
  workspace: string,
  dayHeading: string,
  isVisible: boolean
): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  window.localStorage.setItem(workoutStopwatchVisibilityKey(workspace, dayHeading), String(isVisible));
}

export { toggleWorkoutBlock };
