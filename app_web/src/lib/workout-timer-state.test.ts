import { describe, expect, it } from 'vitest';

import { advanceTimerPhase } from './workout-timer-state';

describe('advanceTimerPhase', () => {
  it('automatically loops rest-between-sets into next active set', () => {
    const fromActive = advanceTimerPhase({
      phase: 'active',
      isExercise: true,
      currentSet: 1,
      setCount: 3,
      activeSeconds: 45,
      restBetweenSetsSeconds: 90,
      restBetweenExercisesSeconds: 120,
      currentBlockIndex: 0,
      blockCount: 3,
    });

    expect(fromActive).toMatchObject({
      phase: 'rest-between-sets',
      isRunning: true,
      remainingSeconds: 90,
      currentSet: 1,
      markBlockComplete: false,
    });

    const toNextSet = advanceTimerPhase({
      phase: fromActive.phase,
      isExercise: true,
      currentSet: fromActive.currentSet,
      setCount: 3,
      activeSeconds: 45,
      restBetweenSetsSeconds: 90,
      restBetweenExercisesSeconds: 120,
      currentBlockIndex: 0,
      blockCount: 3,
    });

    expect(toNextSet).toMatchObject({
      phase: 'active',
      isRunning: true,
      remainingSeconds: 45,
      currentSet: 2,
      markBlockComplete: false,
    });
  });

  it('stops after final set transition rest and waits on next block', () => {
    const finalSetDone = advanceTimerPhase({
      phase: 'active',
      isExercise: true,
      currentSet: 3,
      setCount: 3,
      activeSeconds: 45,
      restBetweenSetsSeconds: 90,
      restBetweenExercisesSeconds: 120,
      currentBlockIndex: 0,
      blockCount: 3,
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
      currentBlockIndex: 0,
      blockCount: 3,
    });

    expect(afterTransitionRest).toMatchObject({
      phase: 'idle',
      isRunning: false,
      selectBlockIndex: 1,
    });
  });

  it('preserves phase progression for paused countdown resume scenarios', () => {
    const pausedRestThenAdvance = advanceTimerPhase({
      phase: 'rest-between-sets',
      isExercise: true,
      currentSet: 2,
      setCount: 3,
      activeSeconds: 50,
      restBetweenSetsSeconds: 75,
      restBetweenExercisesSeconds: 120,
      currentBlockIndex: 0,
      blockCount: 2,
    });

    expect(pausedRestThenAdvance).toMatchObject({
      phase: 'active',
      isRunning: true,
      currentSet: 3,
      remainingSeconds: 50,
    });
  });
});
