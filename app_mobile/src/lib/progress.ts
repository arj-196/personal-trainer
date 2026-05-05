import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  normalizeCompletedWorkoutIds,
  toggleWorkoutBlock,
  workoutProgressKey,
} from '@personal-trainer/shared/workout';

export async function readWorkoutProgress(workspace: string, dayHeading: string): Promise<string[]> {
  const rawValue = await AsyncStorage.getItem(workoutProgressKey(workspace, dayHeading));
  if (!rawValue) {
    return [];
  }

  try {
    return normalizeCompletedWorkoutIds(JSON.parse(rawValue));
  } catch {
    return [];
  }
}

export async function writeWorkoutProgress(
  workspace: string,
  dayHeading: string,
  completedIds: string[]
): Promise<void> {
  await AsyncStorage.setItem(workoutProgressKey(workspace, dayHeading), JSON.stringify(completedIds));
}

export { toggleWorkoutBlock };
