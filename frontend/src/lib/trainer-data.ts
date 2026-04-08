import { blobPath, getTrainerDataSource } from './storage-config';
import { listBlobFolders, readBlobText } from './blob-storage';
import {
  listLocalWorkspaces,
  readLocalExerciseCatalogText,
  readLocalWorkspaceText,
} from './local-storage';

export type WorkoutExercise = {
  name: string;
  prescription: string;
  notes: string;
  sets: number;
  activeSeconds: number;
  restBetweenSetsSeconds: number;
  restBetweenExercisesSeconds: number;
  imageUrl: string | null;
  referencePath: string | null;
};

export type WorkoutDay = {
  heading: string;
  warmup: string;
  warmupActiveSeconds: number;
  exercises: WorkoutExercise[];
  finisher: string;
  finisherActiveSeconds: number;
  recovery: string;
  recoveryActiveSeconds: number;
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
  image_url: string;
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

  const plan = normalizeWorkoutPlan(JSON.parse(text) as Record<string, unknown>);
  const needsCatalogLookup = plan.days.some((day) =>
    day.exercises.some((exercise) => !exercise.imageUrl)
  );
  if (!needsCatalogLookup) {
    return plan;
  }

  const references = await readExerciseLibrary();
  const referenceMap = new Map(references.map((reference) => [reference.name, reference]));
  return {
    ...plan,
    days: plan.days.map((day) => ({
      ...day,
      exercises: day.exercises.map((exercise) => ({
        ...exercise,
        imageUrl: exercise.imageUrl ?? referenceMap.get(exercise.name)?.image_url ?? null,
      })),
    })),
  };
}

export async function readExerciseLibrary(): Promise<ExerciseReference[]> {
  const text =
    getTrainerDataSource() === 'blob'
      ? await readBlobText(blobPath('exercise-library', 'catalog.json'))
      : readLocalExerciseCatalogText();

  if (!text) {
    return [];
  }

  return (JSON.parse(text) as Array<Record<string, unknown>>).map(normalizeExerciseReference);
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

function normalizeWorkoutPlan(payload: Record<string, unknown>): WorkoutPlan {
  const days = Array.isArray(payload.days) ? payload.days : [];
  return {
    ...(payload as WorkoutPlan),
    days: days.map((day) => {
      const typedDay = day as WorkoutDay & {
        exercises?: Array<
          WorkoutExercise & {
            imagePath?: string | null;
            imageUrl?: string | null;
          }
        >;
      };
      return {
        ...typedDay,
        warmupActiveSeconds: normalizePositiveInt((typedDay as { warmupActiveSeconds?: unknown }).warmupActiveSeconds, 300),
        exercises: Array.isArray(typedDay.exercises)
          ? typedDay.exercises.map((exercise) => ({
              ...exercise,
              sets: normalizePositiveInt((exercise as { sets?: unknown }).sets, 3),
              activeSeconds: normalizePositiveInt((exercise as { activeSeconds?: unknown }).activeSeconds, 45),
              restBetweenSetsSeconds: normalizePositiveInt(
                (exercise as { restBetweenSetsSeconds?: unknown }).restBetweenSetsSeconds,
                90
              ),
              restBetweenExercisesSeconds: normalizePositiveInt(
                (exercise as { restBetweenExercisesSeconds?: unknown }).restBetweenExercisesSeconds,
                120
              ),
              imageUrl:
                typeof exercise.imageUrl === 'string' && /^https?:\/\//.test(exercise.imageUrl)
                  ? exercise.imageUrl
                  : null,
            }))
          : [],
        finisherActiveSeconds: normalizePositiveInt(
          (typedDay as { finisherActiveSeconds?: unknown }).finisherActiveSeconds,
          300
        ),
        recoveryActiveSeconds: normalizePositiveInt(
          (typedDay as { recoveryActiveSeconds?: unknown }).recoveryActiveSeconds,
          300
        ),
      };
    }),
  };
}

function normalizeExerciseReference(payload: Record<string, unknown>): ExerciseReference {
  return {
    ...(payload as ExerciseReference),
    image_url: typeof payload.image_url === 'string' ? payload.image_url : '',
  };
}

function normalizePositiveInt(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : fallback;
}
