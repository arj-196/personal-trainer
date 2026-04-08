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
