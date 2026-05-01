'use client';

import { useEffect, useState } from 'react';

import type { WorkoutDay } from '@/lib/trainer-data';
import { buildWorkoutDayBlocks } from '@/lib/workout-helpers';
import {
  readWorkoutProgress,
  toggleWorkoutBlock,
  writeWorkoutProgress,
} from '@/lib/workout-progress';
import { advanceTimerPhase, type TimerPhase } from '@/lib/workout-timer-state';

import { WorkoutBlockCard } from './workout-block-card';

type StartWorkoutViewProps = {
  day: WorkoutDay;
  workspace: string;
};

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

export function StartWorkoutView({ day, workspace }: StartWorkoutViewProps) {
  const blocks = buildWorkoutDayBlocks(day);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [currentBlockIndex, setCurrentBlockIndex] = useState(0);
  const [timerPhase, setTimerPhase] = useState<TimerPhase>('idle');
  const [isRunning, setIsRunning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [currentSet, setCurrentSet] = useState(1);

  useEffect(() => {
    const storedProgress = readWorkoutProgress(workspace, day.heading);
    setCompletedIds(storedProgress);
    const firstIncompleteIndex = blocks.findIndex((block) => !storedProgress.includes(block.id));
    setCurrentBlockIndex(firstIncompleteIndex >= 0 ? firstIncompleteIndex : 0);
    setTimerPhase('idle');
    setIsRunning(false);
    setRemainingSeconds(0);
    setCurrentSet(1);
  }, [workspace, day.heading]);

  useEffect(() => {
    writeWorkoutProgress(workspace, day.heading, completedIds);
  }, [workspace, day.heading, completedIds]);

  const currentBlock = blocks[Math.min(currentBlockIndex, Math.max(blocks.length - 1, 0))];
  const isCurrentExercise = currentBlock?.kind === 'exercise';

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

    let nextRemaining = nextState.remainingSeconds;
    if (nextState.selectBlockIndex !== null) {
      const nextBlock = blocks[nextState.selectBlockIndex];
      setCurrentBlockIndex(nextState.selectBlockIndex);
      setCurrentSet(1);
      nextRemaining = nextState.phase === 'idle' ? nextBlock?.activeSeconds ?? 0 : nextRemaining;
    } else {
      setCurrentSet(nextState.currentSet);
    }

    setTimerPhase(nextState.phase);
    setIsRunning(nextState.isRunning);
    setRemainingSeconds(nextRemaining);
  }, [isCurrentExercise, isRunning, remainingSeconds, timerPhase, currentSet, currentBlock, currentBlockIndex, blocks.length]);

  const startPauseLabel = isRunning ? 'Pause' : 'Start';

  const startBlock = (blockIndex: number) => {
    const block = blocks[blockIndex];
    if (!block) {
      return;
    }
    setCurrentBlockIndex(blockIndex);
    setCurrentSet(1);
    setTimerPhase('active');
    setRemainingSeconds(block.activeSeconds);
    setIsRunning(true);
  };

  const handleStartPauseToggle = () => {
    if (!currentBlock) {
      return;
    }

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
    setCurrentBlockIndex(targetIndex);
    setCurrentSet(1);
    setTimerPhase('idle');
    setRemainingSeconds(block.activeSeconds);
    setIsRunning(false);
  };

  const completedCount = completedIds.length;
  const totalCount = blocks.length;
  const progressLabel = `${completedCount}/${totalCount}`;
  const isRestPhase = timerPhase === 'rest-between-sets' || timerPhase === 'rest-between-exercises';
  const coachMode = timerPhase === 'active' ? 'Exercise' : isRestPhase ? 'Rest' : 'Ready';
  const coachCopy =
    timerPhase === 'active'
      ? 'Push now. Keep form clean.'
      : isRestPhase
        ? 'Recover now. Breathe and reset.'
        : 'Tap Start when you begin the next exercise.';

  return (
    <section className="grid gap-4 sm:gap-5">
      <section className="sticky top-1 z-20 rounded-[1.5rem] border border-white/50 bg-[radial-gradient(circle_at_top_right,rgba(34,184,199,0.28),transparent_35%),linear-gradient(160deg,#15171c_0%,#21252d_65%,#191d24_100%)] p-2 text-white shadow-[0_22px_60px_rgba(20,24,30,0.16)] sm:p-2.5">
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
          {blocks.map((block) => (
            <WorkoutBlockCard
              key={block.id}
              block={block}
              display="start"
              checked={completedIds.includes(block.id)}
              onToggle={(blockId) => setCompletedIds((current) => toggleWorkoutBlock(current, blockId))}
            />
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
