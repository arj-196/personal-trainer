const STORAGE_PREFIX = 'personal-trainer:workout-progress';

function progressKey(workspace: string, dayHeading: string): string {
  return `${STORAGE_PREFIX}:${workspace}:${dayHeading}`;
}

export function readWorkoutProgress(workspace: string, dayHeading: string): string[] {
  if (typeof window === 'undefined' || !window.localStorage) {
    return [];
  }

  const rawValue = window.localStorage.getItem(progressKey(workspace, dayHeading));
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export function writeWorkoutProgress(workspace: string, dayHeading: string, completedIds: string[]): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  window.localStorage.setItem(progressKey(workspace, dayHeading), JSON.stringify(completedIds));
}

export function toggleWorkoutBlock(completedIds: string[], blockId: string): string[] {
  const completedSet = new Set(completedIds);
  if (completedSet.has(blockId)) {
    completedSet.delete(blockId);
  } else {
    completedSet.add(blockId);
  }

  return Array.from(completedSet);
}
