'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import type { WorkoutDay } from '@/lib/trainer-data';
import { playWorkoutCue } from '@/lib/audio-cues';
import { buildWorkoutDayBlocks } from '@/lib/workout-helpers';
import {
  readWorkoutProgress,
  readWorkoutStopwatchVisibility,
  toggleWorkoutBlock,
  writeWorkoutProgress,
  writeWorkoutStopwatchVisibility,
} from '@/lib/workout-progress';
import { advanceTimerPhase, type TimerPhase } from '@/lib/workout-timer-state';
import { ButtonLink, cx } from '@/components/ui';

import { WorkoutBlockCard, type BlockCardState } from './workout-block-card';
import { WorkoutSessionChat } from './workout-session-chat';

type StartWorkoutViewProps = {
  day: WorkoutDay;
  workspace: string;
};

const PRE_START_BUFFER_SECONDS = 3;

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6">
      <path d="M8 6v12l10-6-10-6Z" fill="currentColor" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6">
      <path d="M7 5h4v14H7V5Zm6 0h4v14h-4V5Z" fill="currentColor" />
    </svg>
  );
}

function TimerIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path d="M10 2h4v2h-4V2Zm1 9h2v5h-2v-5Zm1-5a8 8 0 1 1 0 16 8 8 0 0 1 0-16Zm0 2a6 6 0 1 0 0 12 6 6 0 0 0 0-12Zm5.2-.8 1.4-1.4 1.6 1.6-1.4 1.4-1.6-1.6Z" fill="currentColor" />
    </svg>
  );
}

/** Timer-phase presentation: label, coach copy, chip + digit colors (light island). */
type PhasePresentation = {
  label: string;
  copy: string;
  digitClass: string;
  chipClass: string;
};

const PHASE_PRESENTATION: Record<string, PhasePresentation> = {
  ready: {
    label: 'READY',
    copy: 'Press play. Attack.',
    digitClass: 'text-ink',
    chipClass: 'bg-bg2 text-ink',
  },
  getready: {
    label: 'GET READY',
    copy: 'Chalk up.',
    digitClass: 'text-gold-deep',
    chipClass: 'bg-gold-soft text-gold-deep',
  },
  work: {
    label: 'EXERCISE',
    copy: 'Push now. Keep form clean.',
    digitClass: 'text-acc-deep',
    chipClass: 'bg-acc-soft text-acc-deep',
  },
  rest: {
    label: 'REST',
    copy: 'Breathe. You’re a machine.',
    digitClass: 'text-teal-deep',
    chipClass: 'bg-teal-soft text-teal-deep',
  },
  restx: {
    label: 'NEXT UP',
    copy: 'Walk it off. Next station.',
    digitClass: 'text-vio-deep',
    chipClass: 'bg-vio-soft text-vio-deep',
  },
  done: {
    label: 'DONE',
    copy: 'Day conquered.',
    digitClass: 'text-teal-deep',
    chipClass: 'bg-teal-soft text-teal-deep',
  },
};

export function StartWorkoutView({ day, workspace }: StartWorkoutViewProps) {
  const blocks = buildWorkoutDayBlocks(day);
  const blockRefs = useRef<Array<HTMLElement | null>>([]);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [currentBlockIndex, setCurrentBlockIndex] = useState(0);
  const [timerPhase, setTimerPhase] = useState<TimerPhase>('idle');
  const [isRunning, setIsRunning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [currentSet, setCurrentSet] = useState(1);
  const [pendingStartBlockIndex, setPendingStartBlockIndex] = useState<number | null>(null);
  const [isStopwatchVisible, setIsStopwatchVisible] = useState(false);
  const [isChatVisible, setIsChatVisible] = useState(false);
  const [zoomedBlockIndex, setZoomedBlockIndex] = useState<number | null>(null);

  useEffect(() => {
    const storedProgress = readWorkoutProgress(workspace, day.heading);
    const storedStopwatchVisibility = readWorkoutStopwatchVisibility(workspace, day.heading);
    setCompletedIds(storedProgress);
    const firstIncompleteIndex = blocks.findIndex((block) => !storedProgress.includes(block.id));
    setCurrentBlockIndex(firstIncompleteIndex >= 0 ? firstIncompleteIndex : 0);
    setTimerPhase('idle');
    setIsRunning(false);
    setRemainingSeconds(0);
    setCurrentSet(1);
    setPendingStartBlockIndex(null);
    setIsStopwatchVisible(storedStopwatchVisibility);
    blockRefs.current = [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace, day.heading]);

  const selectBlock = (blockIndex: number, options?: { shouldFocus?: boolean }) => {
    const block = blocks[blockIndex];
    if (!block) {
      return;
    }

    setCurrentBlockIndex(blockIndex);
    if (!options?.shouldFocus) {
      return;
    }

    const blockElement = blockRefs.current[blockIndex];
    if (!blockElement) {
      return;
    }

    blockElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    blockElement.focus({ preventScroll: true });
  };

  useEffect(() => {
    writeWorkoutProgress(workspace, day.heading, completedIds);
  }, [workspace, day.heading, completedIds]);

  useEffect(() => {
    writeWorkoutStopwatchVisibility(workspace, day.heading, isStopwatchVisible);
  }, [workspace, day.heading, isStopwatchVisible]);

  const currentBlock = blocks[Math.min(currentBlockIndex, Math.max(blocks.length - 1, 0))];
  const isCurrentExercise = currentBlock?.kind === 'exercise';
  const isTimerLocked = isRunning;

  useEffect(() => {
    if (!isRunning || remainingSeconds <= 0) {
      return;
    }

    const tick = window.setInterval(() => {
      setRemainingSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);

    return () => window.clearInterval(tick);
  }, [isRunning, remainingSeconds]);

  useEffect(() => {
    if (!isRunning || remainingSeconds > 0 || !currentBlock) {
      return;
    }

    if (pendingStartBlockIndex !== null) {
      const blockToStart = blocks[pendingStartBlockIndex];
      if (!blockToStart) {
        setPendingStartBlockIndex(null);
        setIsRunning(false);
        setTimerPhase('idle');
        return;
      }
      setTimerPhase('active');
      setRemainingSeconds(blockToStart.activeSeconds);
      setCurrentSet(1);
      setIsRunning(true);
      setPendingStartBlockIndex(null);
      void playWorkoutCue('exercise-start');
      return;
    }

    const nextState = advanceTimerPhase({
      phase: timerPhase,
      isExercise: isCurrentExercise,
      currentSet,
      setCount: currentBlock.setCount,
      activeSeconds: currentBlock.activeSeconds,
      restBetweenSetsSeconds: currentBlock.restBetweenSetsSeconds,
      restBetweenExercisesSeconds: currentBlock.restBetweenExercisesSeconds,
      currentBlockIndex,
      blockCount: blocks.length,
    });

    if (nextState.markBlockComplete) {
      setCompletedIds((current) =>
        current.includes(currentBlock.id) ? current : [...current, currentBlock.id]
      );
    }

    const previousPhase = timerPhase;
    const nextBlock = nextState.selectBlockIndex !== null ? blocks[nextState.selectBlockIndex] : null;
    if (nextState.selectBlockIndex !== null) {
      selectBlock(nextState.selectBlockIndex, { shouldFocus: true });
    }

    setCurrentSet(nextState.currentSet);

    setTimerPhase(nextState.phase);
    setIsRunning(nextState.isRunning);
    setRemainingSeconds(
      nextState.phase === 'idle' && nextBlock ? nextBlock.activeSeconds : nextState.remainingSeconds
    );

    if (previousPhase !== nextState.phase) {
      if (nextState.phase === 'rest-between-sets') {
        void playWorkoutCue('rest-between-sets');
      } else if (nextState.phase === 'rest-between-exercises') {
        void playWorkoutCue('rest-between-exercises');
      } else if (nextState.phase === 'complete') {
        void playWorkoutCue('session-complete');
      } else if (
        previousPhase === 'rest-between-sets' &&
        nextState.phase === 'active'
      ) {
        void playWorkoutCue('exercise-start');
      }
    }
  }, [
    isCurrentExercise,
    isRunning,
    remainingSeconds,
    timerPhase,
    currentSet,
    currentBlock,
    currentBlockIndex,
    blocks,
    pendingStartBlockIndex,
  ]);

  const startPauseLabel = isRunning ? 'Pause' : 'Start';

  const startBlock = (blockIndex: number) => {
    const block = blocks[blockIndex];
    if (!block) {
      return;
    }
    selectBlock(blockIndex, { shouldFocus: true });
    setIsStopwatchVisible(true);
    setCurrentSet(1);
    setPendingStartBlockIndex(blockIndex);
    setTimerPhase('idle');
    setRemainingSeconds(PRE_START_BUFFER_SECONDS);
    setIsRunning(true);
  };

  const handleStartPauseToggle = () => {
    if (!currentBlock) {
      return;
    }

    setIsStopwatchVisible(true);

    if (isRunning) {
      setIsRunning(false);
      return;
    }

    if (timerPhase === 'idle' || timerPhase === 'complete') {
      startBlock(currentBlockIndex);
      return;
    }

    if (remainingSeconds > 0) {
      setIsRunning(true);
    }
  };

  const resetTimerAt = (targetIndex: number) => {
    const block = blocks[targetIndex];
    if (!block) {
      return;
    }
    selectBlock(targetIndex, { shouldFocus: true });
    setCurrentSet(1);
    setTimerPhase('idle');
    setRemainingSeconds(block.activeSeconds);
    setIsRunning(false);
    setPendingStartBlockIndex(null);
  };

  const jumpToBlock = (offset: -1 | 1) => {
    const targetIndex = currentBlockIndex + offset;
    if (targetIndex < 0 || targetIndex >= blocks.length) {
      return;
    }
    resetTimerAt(targetIndex);
  };

  const handleToggleDone = (blockIndex: number) => {
    const block = blocks[blockIndex];
    if (!block) {
      return;
    }
    const willComplete = !completedIds.includes(block.id);
    setCompletedIds((current) => toggleWorkoutBlock(current, block.id));
    if (willComplete && blockIndex === currentBlockIndex) {
      // Move the pointer to the next unfinished block, like the auto-advance does.
      const nextIncomplete = blocks.findIndex(
        (candidate, index) =>
          index !== blockIndex && !completedIds.includes(candidate.id) && index > blockIndex,
      );
      const fallback = blocks.findIndex(
        (candidate, index) => index !== blockIndex && !completedIds.includes(candidate.id),
      );
      const targetIndex = nextIncomplete >= 0 ? nextIncomplete : fallback;
      if (targetIndex >= 0) {
        // Manual completion of the running block: stop the timer and re-arm
        // it on the next unfinished block.
        resetTimerAt(targetIndex);
      }
    }
  };

  const completedCount = completedIds.length;
  const totalCount = blocks.length;
  const isSessionDone = completedCount >= totalCount && totalCount > 0;
  const cheer = completedCount === 0 ? 'Let’s go' : isSessionDone ? 'Dinner earned' : 'Earn your dinner';

  const phaseKey =
    pendingStartBlockIndex !== null
      ? 'getready'
      : timerPhase === 'active'
        ? 'work'
        : timerPhase === 'rest-between-sets'
          ? 'rest'
          : timerPhase === 'rest-between-exercises'
            ? 'restx'
            : timerPhase === 'complete'
              ? 'done'
              : 'ready';
  const phase = PHASE_PRESENTATION[phaseKey];

  const toggleStopwatchVisibility = () => {
    if (isStopwatchVisible && isTimerLocked) {
      return;
    }

    setIsStopwatchVisible((current) => !current);
  };

  const exerciseCount = blocks.filter((block) => block.kind === 'exercise').length;
  const kindLabelFor = (blockIndex: number): string => {
    const block = blocks[blockIndex];
    switch (block.kind) {
      case 'warmup':
        return 'Warm-up';
      case 'finisher':
        return 'Finisher';
      case 'recovery':
        return 'Recovery';
      default: {
        const ordinal = blocks
          .slice(0, blockIndex + 1)
          .filter((candidate) => candidate.kind === 'exercise').length;
        return blockIndex === currentBlockIndex && !completedIds.includes(block.id)
          ? `Exercise · ${ordinal} of ${exerciseCount}`
          : 'Exercise';
      }
    }
  };

  const completedSetsForCurrent =
    timerPhase === 'rest-between-sets' ? currentSet : Math.max(0, currentSet - 1);

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-ink">
      {/* header */}
      <header className="sticky top-0 z-30 flex flex-col gap-2 bg-bg px-4 pb-2.5 pt-3.5">
        <div className="flex items-center justify-between gap-2">
          <Link
            href={`/workout/${encodeURIComponent(workspace)}`}
            aria-label="Exit session"
            className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full border border-ln bg-transparent text-[16px] text-ink"
          >
            ←
          </Link>
          <h1 className="m-0 overflow-hidden text-ellipsis whitespace-nowrap font-display text-[19px] font-extrabold">
            {day.heading}
          </h1>
          <div className="w-[38px] flex-none" />
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-[12px] text-fnt">
            <span>
              {completedCount} of {totalCount} blocks
            </span>
            <span className="font-semibold text-acc-deep">{cheer}</span>
          </div>
          <div className="h-[5px] rounded-full bg-ln">
            <div
              className="h-full rounded-full bg-acc transition-[width] duration-300"
              style={{ width: `${(completedCount / Math.max(totalCount, 1)) * 100}%` }}
            />
          </div>
        </div>
      </header>

      {/* block list */}
      <div
        className={cx(
          'flex flex-1 flex-col gap-2 px-2 pt-0.5',
          isStopwatchVisible
            ? 'pb-[calc(248px+env(safe-area-inset-bottom))]'
            : 'pb-[calc(88px+env(safe-area-inset-bottom))]',
        )}
      >
        {blocks.map((block, index) => {
          const isDone = completedIds.includes(block.id);
          const state: BlockCardState =
            isDone ? 'done' : index === currentBlockIndex ? 'current' : 'pending';
          return (
            <div
              key={block.id}
              ref={(element) => {
                blockRefs.current[index] = element;
              }}
              tabIndex={-1}
            >
              <WorkoutBlockCard
                block={block}
                state={state}
                kindLabel={kindLabelFor(index)}
                setLabel={
                  state === 'current' && block.kind === 'exercise'
                    ? `Set ${Math.min(currentSet, block.setCount)} of ${block.setCount}`
                    : null
                }
                completedSets={state === 'current' ? completedSetsForCurrent : 0}
                isZoomed={zoomedBlockIndex === index}
                onToggleDone={() => handleToggleDone(index)}
                onSelect={() => resetTimerAt(index)}
                onToggleZoom={() =>
                  setZoomedBlockIndex((current) => (current === index ? null : index))
                }
              />
            </div>
          );
        })}

        {isSessionDone ? (
          <div className="flex flex-col items-center gap-1.5 rounded-[16px] border border-teal bg-teal-soft p-[18px] text-center">
            <div className="font-display text-[22px] font-extrabold text-teal-deep">
              Day conquered.
            </div>
            <p className="m-0 text-[13px] text-mut">
              Every block done. Go earn your dinner — Jeff is waiting.
            </p>
            <ButtonLink variant="ink" size="sm" className="mt-1 h-10 px-[18px] text-[13px]" href="/recipes">
              Ask Jeff the Cook →
            </ButtonLink>
          </div>
        ) : null}
      </div>

      {/* floating action buttons */}
      <div
        className={cx(
          'fixed z-[35] flex flex-col gap-2.5 right-[max(14px,calc(50%-226px))]',
          isStopwatchVisible
            ? 'bottom-[calc(240px+env(safe-area-inset-bottom))]'
            : 'bottom-[calc(18px+env(safe-area-inset-bottom))]',
        )}
      >
        <button
          type="button"
          onClick={() => setIsChatVisible((current) => !current)}
          aria-label={isChatVisible ? 'Hide coach chat' : 'Ask Arnold'}
          className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border border-ln bg-card font-display text-[16px] font-extrabold text-ink shadow-[0_6px_18px_rgba(0,0,0,0.35)]"
        >
          A
        </button>
        <button
          type="button"
          onClick={toggleStopwatchVisibility}
          aria-label={isStopwatchVisible ? 'Hide timer' : 'Show timer'}
          title={
            isStopwatchVisible && isTimerLocked
              ? 'Pause the timer before hiding it'
              : undefined
          }
          className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border-none bg-acc text-white shadow-[0_6px_18px_rgba(255,106,61,0.4)]"
        >
          <TimerIcon />
        </button>
      </div>

      <WorkoutSessionChat
        workspace={workspace}
        dayHeading={day.heading}
        isOpen={isChatVisible}
        isStopwatchVisible={isStopwatchVisible}
        onClose={() => setIsChatVisible(false)}
      />

      {/* timer dock */}
      {isStopwatchVisible ? (
        <section
          aria-label="Timer"
          className="theme-light fixed inset-x-0 bottom-[calc(10px+env(safe-area-inset-bottom))] z-30 mx-auto flex w-auto max-w-[460px] flex-col gap-1.5 rounded-[20px] bg-bg px-4 pb-3.5 pt-3 text-ink shadow-[0_-10px_40px_rgba(0,0,0,0.45)] max-[480px]:mx-2.5"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-semibold">
              {currentBlock?.name ?? 'No block selected'}
            </div>
            <div className="max-w-[45%] overflow-hidden text-ellipsis whitespace-nowrap text-[11.5px] font-semibold text-mut">
              {isCurrentExercise && currentBlock
                ? `Set ${Math.min(currentSet, currentBlock.setCount)} / ${currentBlock.setCount}`
                : currentBlock?.prescription}
            </div>
          </div>
          <div className="flex items-center justify-between gap-2.5">
            <button
              type="button"
              onClick={() => jumpToBlock(-1)}
              disabled={currentBlockIndex === 0}
              aria-label="Previous block"
              className="h-11 w-11 flex-none cursor-pointer rounded-full border border-ln2 bg-transparent text-[16px] text-ink disabled:opacity-40"
            >
              ‹
            </button>
            <div className="flex min-w-0 flex-col items-center gap-1">
              <div
                className={cx(
                  'font-display text-[52px] font-extrabold leading-[0.95] tabular-nums',
                  phase.digitClass,
                )}
              >
                {formatDuration(remainingSeconds)}
              </div>
              <span
                className={cx(
                  'whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold tracking-[0.4px]',
                  phase.chipClass,
                )}
              >
                {phase.label} — {phase.copy}
              </span>
            </div>
            <button
              type="button"
              onClick={() => jumpToBlock(1)}
              disabled={currentBlockIndex >= blocks.length - 1}
              aria-label="Next block"
              className="h-11 w-11 flex-none cursor-pointer rounded-full border border-ln2 bg-transparent text-[16px] text-ink disabled:opacity-40"
            >
              ›
            </button>
          </div>
          <button
            type="button"
            onClick={handleStartPauseToggle}
            aria-label={startPauseLabel}
            className="flex h-[58px] w-[58px] cursor-pointer items-center justify-center self-center rounded-full border-none bg-ink text-onink"
          >
            {isRunning ? <PauseIcon /> : <PlayIcon />}
          </button>
        </section>
      ) : null}
    </div>
  );
}

function formatDuration(totalSeconds: number): string {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}
