import { describe, expect, it } from 'vitest';

import {
  advanceTimerPhase,
  buildWorkoutDayBlocks,
  googleImagesSearchUrl,
  normalizeCompletedWorkoutIds,
  normalizeWorkoutPlan,
  toggleWorkoutBlock,
  workoutProgressKey,
  workoutStopwatchVisibilityKey,
} from './workout';

describe('normalizeWorkoutPlan', () => {
  it('applies timing defaults and ignores non-http image URLs', () => {
    const plan = normalizeWorkoutPlan({
      title: 'Legacy',
      meta: [],
      summary: '',
      progression: '',
      nextCheckIn: '',
      days: [
        {
          heading: 'Day 1',
          warmup: 'Move',
          exercises: [
            {
              name: 'Squat',
              prescription: '3 x 10',
              notes: '',
              imageUrl: '/local/squat.jpg',
            },
          ],
          finisher: '',
          recovery: '',
        },
      ],
    });

    expect(plan.days[0].warmupActiveSeconds).toBe(300);
    expect(plan.days[0].exercises[0]).toMatchObject({
      sets: 3,
      activeSeconds: 45,
      restBetweenSetsSeconds: 90,
      restBetweenExercisesSeconds: 120,
      imageUrl: null,
    });
  });
});

describe('workout progress helpers', () => {
  it('builds stable progress keys and toggles completion ids', () => {
    expect(workoutProgressKey('wk_arj', 'Day 1')).toBe('personal-trainer:workout-progress:wk_arj:Day 1');
    expect(workoutStopwatchVisibilityKey('wk_arj', 'Day 1')).toBe(
      'personal-trainer:stopwatch-visible:wk_arj:Day 1'
    );
    expect(toggleWorkoutBlock(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleWorkoutBlock(['a', 'b'], 'a')).toEqual(['b']);
    expect(normalizeCompletedWorkoutIds(['a', 1, 'b'])).toEqual(['a', 'b']);
  });
});

describe('buildWorkoutDayBlocks', () => {
  it('builds warm-up, exercise, finisher, and recovery blocks in order', () => {
    const blocks = buildWorkoutDayBlocks({
      heading: 'Day 1',
      warmup: 'Bike',
      warmupActiveSeconds: 300,
      exercises: [
        {
          name: 'Goblet Squat',
          prescription: '3 x 10',
          notes: 'Smooth reps',
          sets: 3,
          activeSeconds: 45,
          restBetweenSetsSeconds: 90,
          restBetweenExercisesSeconds: 120,
          imageUrl: 'https://example.test/squat.jpg',
        },
      ],
      finisher: 'Sprints',
      finisherActiveSeconds: 240,
      recovery: 'Walk',
      recoveryActiveSeconds: 180,
    });

    expect(blocks.map((block) => block.kind)).toEqual(['warmup', 'exercise', 'finisher', 'recovery']);
    expect(blocks[1]).toMatchObject({
      name: 'Goblet Squat',
      activeSeconds: 45,
      setCount: 3,
    });
  });
});

describe('advanceTimerPhase', () => {
  it('cycles active exercise sets through rest-between-sets', () => {
    expect(advanceTimerPhase({
      phase: 'active',
      isExercise: true,
      currentSet: 1,
      setCount: 3,
      activeSeconds: 45,
      restBetweenSetsSeconds: 90,
      restBetweenExercisesSeconds: 120,
      currentBlockIndex: 0,
      blockCount: 2,
    })).toMatchObject({
      phase: 'rest-between-sets',
      isRunning: true,
      remainingSeconds: 90,
      markBlockComplete: false,
    });
  });

  it('waits on the next block after between-exercises rest instead of advancing twice', () => {
    const finalSetDone = advanceTimerPhase({
      phase: 'active',
      isExercise: true,
      currentSet: 3,
      setCount: 3,
      activeSeconds: 45,
      restBetweenSetsSeconds: 90,
      restBetweenExercisesSeconds: 120,
      currentBlockIndex: 1,
      blockCount: 4,
    });

    expect(finalSetDone).toMatchObject({
      phase: 'rest-between-exercises',
      isRunning: true,
      remainingSeconds: 120,
      markBlockComplete: true,
      selectBlockIndex: null,
    });

    const afterTransitionRest = advanceTimerPhase({
      phase: finalSetDone.phase,
      isExercise: true,
      currentSet: finalSetDone.currentSet,
      setCount: 3,
      activeSeconds: 45,
      restBetweenSetsSeconds: 90,
      restBetweenExercisesSeconds: 120,
      currentBlockIndex: 1,
      blockCount: 4,
    });

    expect(afterTransitionRest).toMatchObject({
      phase: 'idle',
      isRunning: false,
      currentSet: 1,
      markBlockComplete: false,
      selectBlockIndex: 2,
    });
  });

  it('encodes Google Images search URLs', () => {
    expect(googleImagesSearchUrl('Incline Dumbbell Press')).toBe(
      'https://www.google.com/search?tbm=isch&q=Incline%20Dumbbell%20Press'
    );
  });
});
