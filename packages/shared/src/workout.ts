export type WorkoutExercise = {
  name: string;
  prescription: string;
  notes: string;
  sets: number;
  activeSeconds: number;
  restBetweenSetsSeconds: number;
  restBetweenExercisesSeconds: number;
  imageUrl: string | null;
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

export type UserProfileSummary = {
  name: string;
  goal: string;
};

export type WorkoutBlockKind = 'warmup' | 'exercise' | 'finisher' | 'recovery';

export type WorkoutBlock = {
  id: string;
  kind: WorkoutBlockKind;
  name: string;
  prescription: string;
  notes: string;
  activeSeconds: number;
  setCount: number;
  restBetweenSetsSeconds: number | null;
  restBetweenExercisesSeconds: number | null;
  imageUrl: string | null;
  searchName: string | null;
};

export type TimerPhase = 'idle' | 'active' | 'rest-between-sets' | 'rest-between-exercises' | 'complete';

export type TimerAdvanceInput = {
  phase: TimerPhase;
  isExercise: boolean;
  currentSet: number;
  setCount: number;
  activeSeconds: number;
  restBetweenSetsSeconds: number | null;
  restBetweenExercisesSeconds: number | null;
  currentBlockIndex: number;
  blockCount: number;
};

export type TimerAdvanceResult = {
  phase: TimerPhase;
  isRunning: boolean;
  remainingSeconds: number;
  currentSet: number;
  markBlockComplete: boolean;
  selectBlockIndex: number | null;
};

const WORKOUT_PROGRESS_STORAGE_PREFIX = 'personal-trainer:workout-progress';

export function workoutProgressKey(workspace: string, dayHeading: string): string {
  return `${WORKOUT_PROGRESS_STORAGE_PREFIX}:${workspace}:${dayHeading}`;
}

export function normalizeCompletedWorkoutIds(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
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

export function normalizeWorkoutPlan(payload: Record<string, unknown>): WorkoutPlan {
  const days = Array.isArray(payload.days) ? payload.days : [];
  return {
    ...(payload as WorkoutPlan),
    days: days.map((day) => {
      const typedDay = day as WorkoutDay;
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

export function googleImagesSearchUrl(query: string): string {
  return `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}`;
}

export function buildWorkoutDayBlocks(day: WorkoutDay): WorkoutBlock[] {
  const blocks: WorkoutBlock[] = [
    {
      id: `${day.heading}-warmup`,
      kind: 'warmup',
      name: 'Warm-up',
      prescription: day.warmup,
      notes: 'Get joints, lungs, and first movement patterns ready before the working sets.',
      activeSeconds: day.warmupActiveSeconds,
      setCount: 1,
      restBetweenSetsSeconds: null,
      restBetweenExercisesSeconds: null,
      imageUrl: null,
      searchName: null,
    },
    ...day.exercises.map((exercise, index) => ({
      id: `${day.heading}-exercise-${index}-${exercise.name}`,
      kind: 'exercise' as const,
      name: exercise.name,
      prescription: exercise.prescription,
      notes: exercise.notes,
      activeSeconds: exercise.activeSeconds,
      setCount: exercise.sets,
      restBetweenSetsSeconds: exercise.restBetweenSetsSeconds,
      restBetweenExercisesSeconds: exercise.restBetweenExercisesSeconds,
      imageUrl: exercise.imageUrl,
      searchName: exercise.name,
    })),
  ];

  if (day.finisher) {
    blocks.push({
      id: `${day.heading}-finisher`,
      kind: 'finisher',
      name: 'Finisher',
      prescription: day.finisher,
      notes: 'End the session with short conditioning or extra targeted volume.',
      activeSeconds: day.finisherActiveSeconds,
      setCount: 1,
      restBetweenSetsSeconds: null,
      restBetweenExercisesSeconds: null,
      imageUrl: null,
      searchName: null,
    });
  }

  if (day.recovery) {
    blocks.push({
      id: `${day.heading}-recovery`,
      kind: 'recovery',
      name: 'Recovery',
      prescription: day.recovery,
      notes: 'Use this cooldown block to bring effort down and leave the session feeling better.',
      activeSeconds: day.recoveryActiveSeconds,
      setCount: 1,
      restBetweenSetsSeconds: null,
      restBetweenExercisesSeconds: null,
      imageUrl: null,
      searchName: null,
    });
  }

  return blocks;
}

export function advanceTimerPhase(input: TimerAdvanceInput): TimerAdvanceResult {
  const hasNextBlock = input.currentBlockIndex < input.blockCount - 1;

  if (input.phase === 'active') {
    if (!input.isExercise) {
      return {
        phase: hasNextBlock ? 'idle' : 'complete',
        isRunning: false,
        remainingSeconds: 0,
        currentSet: input.currentSet,
        markBlockComplete: true,
        selectBlockIndex: hasNextBlock ? input.currentBlockIndex + 1 : null,
      };
    }

    if (input.currentSet < input.setCount) {
      return {
        phase: 'rest-between-sets',
        isRunning: true,
        remainingSeconds: Math.max(0, input.restBetweenSetsSeconds ?? 0),
        currentSet: input.currentSet,
        markBlockComplete: false,
        selectBlockIndex: null,
      };
    }

    if (hasNextBlock && (input.restBetweenExercisesSeconds ?? 0) > 0) {
      return {
        phase: 'rest-between-exercises',
        isRunning: true,
        remainingSeconds: input.restBetweenExercisesSeconds ?? 0,
        currentSet: input.currentSet,
        markBlockComplete: true,
        selectBlockIndex: null,
      };
    }

    return {
      phase: hasNextBlock ? 'idle' : 'complete',
      isRunning: false,
      remainingSeconds: 0,
      currentSet: input.currentSet,
      markBlockComplete: true,
      selectBlockIndex: hasNextBlock ? input.currentBlockIndex + 1 : null,
    };
  }

  if (input.phase === 'rest-between-sets') {
    return {
      phase: 'active',
      isRunning: true,
      remainingSeconds: input.activeSeconds,
      currentSet: Math.min(input.currentSet + 1, input.setCount),
      markBlockComplete: false,
      selectBlockIndex: null,
    };
  }

  if (input.phase === 'rest-between-exercises') {
    return {
      phase: hasNextBlock ? 'idle' : 'complete',
      isRunning: false,
      remainingSeconds: 0,
      currentSet: 1,
      markBlockComplete: false,
      selectBlockIndex: hasNextBlock ? input.currentBlockIndex + 1 : null,
    };
  }

  return {
    phase: input.phase,
    isRunning: false,
    remainingSeconds: 0,
    currentSet: input.currentSet,
    markBlockComplete: false,
    selectBlockIndex: null,
  };
}

function normalizePositiveInt(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : fallback;
}
