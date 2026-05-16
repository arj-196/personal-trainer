'use client';

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

import { WorkoutBlockCard } from './workout-block-card';
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

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path d="M4 5.5C4 3.6 5.6 2 7.5 2h9C18.4 2 20 3.6 20 5.5v6c0 1.9-1.6 3.5-3.5 3.5H11l-5.2 4.3A1.1 1.1 0 0 1 4 18.5v-13Zm3.5-1.3c-.7 0-1.3.6-1.3 1.3v10.7l4-3.3h6.3c.7 0 1.3-.6 1.3-1.3v-6c0-.7-.6-1.3-1.3-1.3h-9Z" fill="currentColor" />
    </svg>
  );
}

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

  const jumpToBlock = (offset: -1 | 1) => {
    const targetIndex = currentBlockIndex + offset;
    if (targetIndex < 0 || targetIndex >= blocks.length) {
      return;
    }
    const block = blocks[targetIndex];
    selectBlock(targetIndex, { shouldFocus: true });
    setCurrentSet(1);
    setTimerPhase('idle');
    setRemainingSeconds(block.activeSeconds);
    setIsRunning(false);
    setPendingStartBlockIndex(null);
  };

  const completedCount = completedIds.length;
  const totalCount = blocks.length;
  const progressLabel = `${completedCount}/${totalCount}`;
  const isRestPhase = timerPhase === 'rest-between-sets' || timerPhase === 'rest-between-exercises';
  const coachMode =
    pendingStartBlockIndex !== null
      ? 'Get ready'
      : timerPhase === 'active'
        ? 'Exercise'
        : isRestPhase
          ? 'Rest'
          : 'Ready';
  const coachCopy =
    pendingStartBlockIndex !== null
      ? 'Starting in 3 seconds. Set your position.'
      : timerPhase === 'active'
        ? 'Push now. Keep form clean.'
        : isRestPhase
          ? 'Recover now. Breathe and reset.'
          : 'Tap Start when you begin the next exercise.';

  const toggleStopwatchVisibility = () => {
    if (isStopwatchVisible && isTimerLocked) {
      return;
    }

    setIsStopwatchVisible((current) => !current);
  };

  return (
    <section
      className={[
        'grid gap-4 sm:gap-5',
        isStopwatchVisible
          ? 'pb-[calc(242px+env(safe-area-inset-bottom))] sm:pb-[calc(252px+env(safe-area-inset-bottom))]'
          : 'pb-[calc(88px+env(safe-area-inset-bottom))] sm:pb-[calc(96px+env(safe-area-inset-bottom))]',
      ].join(' ')}
    >
      {isStopwatchVisible ? (
        <section className="fixed bottom-[calc(12px+env(safe-area-inset-bottom))] left-3 right-[calc(1rem+3.75rem)] z-20 rounded-[1.5rem] border border-white/50 bg-[radial-gradient(circle_at_top_right,rgba(34,184,199,0.28),transparent_35%),linear-gradient(160deg,#15171c_0%,#21252d_65%,#191d24_100%)] p-2 text-white shadow-[0_22px_60px_rgba(20,24,30,0.16)] sm:bottom-[calc(16px+env(safe-area-inset-bottom))] sm:left-4 sm:right-[calc(1rem+4rem)] sm:p-2.5 xl:left-[max(1rem,calc(50%-36rem))] xl:right-[max(calc(1rem+4rem),calc(50%-36rem+4rem))]">
          <div className="grid grid-cols-[minmax(0,1fr)_96px] items-stretch gap-2 sm:grid-cols-[minmax(0,1fr)_102px] md:grid-cols-[minmax(0,1fr)_112px] md:gap-2.5">
            <div className="min-w-0">
              <h2 className="m-0 truncate font-[Avenir_Next_Condensed,Arial_Narrow,sans-serif] text-[clamp(1rem,2.5vw,1.28rem)] leading-tight">{currentBlock?.name ?? 'No block selected'}</h2>
              <div className="mt-1.5 flex items-baseline gap-2">
                <p className="m-0 text-[clamp(1.55rem,6vw,2.3rem)] font-extrabold leading-none tracking-[0.04em]">{formatDuration(remainingSeconds)}</p>
                {isCurrentExercise && currentBlock ? (
                  <p className="m-0 text-[0.92rem] text-white/82">
                    Set <strong className="text-[1.06rem] text-white">{currentSet}/{currentBlock.setCount}</strong>
                  </p>
                ) : null}
              </div>
              <aside className={[
                'mt-2 grid content-center gap-0.5 rounded-[14px] border p-2 text-white',
                coachMode === 'Exercise'
                  ? 'border-[#ff6359]/50 bg-[#ff6359]/20'
                  : coachMode === 'Rest'
                    ? 'border-cyan-400/50 bg-cyan-400/20'
                    : coachMode === 'Get ready'
                      ? 'border-amber-300/60 bg-amber-300/20'
                      : 'border-white/20 bg-white/10',
              ].join(' ')}>
                <p className="m-0 text-[0.72rem] font-extrabold uppercase tracking-[0.13em]">{coachMode}</p>
                <p className="m-0 text-[0.74rem] leading-[1.3] text-white/86 sm:text-[0.79rem]">{coachCopy}</p>
              </aside>
            </div>
            <aside className="flex min-h-0 flex-col items-stretch gap-2 self-stretch">
              <div className="flex justify-center gap-1.5">
                <button
                  type="button"
                  className="h-8 w-8 rounded-[10px] border border-white/20 bg-white/10 p-0 text-white"
                  onClick={() => jumpToBlock(-1)}
                  disabled={currentBlockIndex === 0}
                  aria-label="Previous block"
                  title="Previous block"
                >
                  ◀
                </button>
                <button
                  type="button"
                  className="h-8 w-8 rounded-[10px] border border-white/20 bg-white/10 p-0 text-white disabled:opacity-40"
                  onClick={() => jumpToBlock(1)}
                  disabled={currentBlockIndex >= blocks.length - 1}
                  aria-label="Next block"
                  title="Next block"
                >
                  ▶
                </button>
              </div>
              <div className="flex min-h-0 flex-1">
                <button
                  type="button"
                  className="inline-flex h-full min-h-[84px] w-full flex-1 items-center justify-center rounded-2xl border border-transparent bg-gradient-to-br from-[#ff6a60] to-[#ff7f5d] p-2 text-white shadow-[0_12px_24px_rgba(255,99,89,0.24)] transition hover:-translate-y-0.5 sm:min-h-[84px] md:min-h-[90px]"
                  onClick={handleStartPauseToggle}
                  aria-label={startPauseLabel}
                  title={startPauseLabel}
                >
                  {isRunning ? <PauseIcon /> : <PlayIcon />}
                </button>
              </div>
            </aside>
          </div>
        </section>
      ) : null}

      <div className="fixed bottom-[calc(16px+env(safe-area-inset-bottom))] right-4 z-50 grid gap-2 xl:right-[max(1rem,calc(50%-36rem))]">
        <button
          type="button"
          className={[
            'inline-flex h-12 w-12 items-center justify-center rounded-full border border-slate-900/10 text-white shadow-[0_14px_36px_rgba(23,24,28,0.26)] transition hover:-translate-y-0.5',
            isChatVisible ? 'bg-cyan-600' : 'bg-[#17181c]',
          ].join(' ')}
          onClick={() => setIsChatVisible((current) => !current)}
          aria-label={isChatVisible ? 'Hide coach chat' : 'Show coach chat'}
          title={isChatVisible ? 'Hide coach chat' : 'Show coach chat'}
        >
          <ChatIcon />
        </button>
        <button
          type="button"
          className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-slate-900/10 bg-[#17181c] text-white shadow-[0_14px_36px_rgba(23,24,28,0.26)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-80"
          onClick={toggleStopwatchVisibility}
          aria-label={isStopwatchVisible ? 'Hide stopwatch' : 'Show stopwatch'}
          title={
            isStopwatchVisible
              ? isTimerLocked
                ? 'Pause or finish the stopwatch before hiding it'
                : 'Hide stopwatch'
              : 'Show stopwatch'
          }
        >
          <TimerIcon />
        </button>
      </div>

      <WorkoutSessionChat
        workspace={workspace}
        dayHeading={day.heading}
        isOpen={isChatVisible}
        isStopwatchVisible={isStopwatchVisible}
      />

      <section className="rounded-[1.75rem] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(248,249,251,0.88)),linear-gradient(180deg,#fff,#fff)] p-5 shadow-[0_20px_45px_rgba(41,51,64,0.08)] backdrop-blur-xl sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-[#ff6359]">Current session</p>
            <h2 className="m-0 font-[Avenir_Next_Condensed,Arial_Narrow,sans-serif] text-[clamp(1.45rem,5.5vw,2.1rem)] leading-none tracking-[-0.03em]">{day.heading}</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-500">Work through one block at a time and keep the phone on this screen.</p>
          </div>
          <div className="grid min-w-[88px] gap-0.5 rounded-[22px] bg-[#17181c] px-3.5 py-3 text-center text-white">
            <strong className="text-[1.2rem] leading-none">{progressLabel}</strong>
            <span className="text-[0.72rem] uppercase tracking-[0.08em] text-white/72">completed</span>
          </div>
        </div>

        <div className="my-[18px] h-2.5 overflow-hidden rounded-full bg-slate-900/10" aria-hidden="true">
          <span className="block h-full rounded-full bg-gradient-to-br from-cyan-500 to-cyan-300" style={{ width: `${(completedCount / Math.max(totalCount, 1)) * 100}%` }} />
        </div>

        <div className="grid gap-4">
          {blocks.map((block, index) => (
            <div
              key={block.id}
              ref={(element) => {
                blockRefs.current[index] = element;
              }}
              tabIndex={-1}
            >
              <WorkoutBlockCard
                block={block}
                display="start"
                checked={completedIds.includes(block.id)}
                onToggle={(blockId) => {
                  setCompletedIds((current) => toggleWorkoutBlock(current, blockId));
                }}
              />
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}

function formatDuration(totalSeconds: number): string {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}
