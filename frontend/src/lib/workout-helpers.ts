import type { WorkoutDay } from './trainer-data';

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
