'use client';

import { useEffect, useMemo, useState } from 'react';

import type { WorkoutDay } from '@/lib/trainer-data';
import { buildWorkoutDayBlocks, type WorkoutBlock } from '@/lib/workout-helpers';
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
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 6v12l10-6-10-6Z" fill="currentColor" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
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
    <section className="panel-stack">
      <section className="workout-timer-panel" aria-live="polite">
        <div className="workout-timer-grid">
          <div className="workout-timer-main">
            <h2 className="workout-timer-title">{currentBlock?.name ?? 'No block selected'}</h2>
            <div className="workout-timer-stats-line">
              <p className="workout-timer-clock">{formatDuration(remainingSeconds)}</p>
              {isCurrentExercise && currentBlock ? (
                <p className="workout-timer-set">
                  Set <strong>{currentSet}/{currentBlock.setCount}</strong>
                </p>
              ) : null}
            </div>
            <aside className={`workout-timer-coach workout-timer-coach-${coachMode.toLowerCase()}`}>
              <p className="workout-timer-coach-mode">{coachMode}</p>
              <p className="workout-timer-coach-copy">{coachCopy}</p>
            </aside>
          </div>
          <aside className="workout-timer-controls">
            <div className="workout-timer-nav-row">
              <button
                type="button"
                className="timer-nav-button"
                onClick={() => jumpToBlock(-1)}
                disabled={currentBlockIndex === 0}
                aria-label="Previous block"
                title="Previous block"
              >
                ◀
              </button>
              <button
                type="button"
                className="timer-nav-button"
                onClick={() => jumpToBlock(1)}
                disabled={currentBlockIndex >= blocks.length - 1}
                aria-label="Next block"
                title="Next block"
              >
                ▶
              </button>
            </div>
            <div className="workout-timer-actions">
              <button
                type="button"
                className="primary-action workout-timer-primary"
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

      <section className="focus-day-card">
        <div className="focus-day-head">
          <div>
            <p className="section-kicker">Current session</p>
            <h2 className="section-title">{day.heading}</h2>
            <p className="section-copy">Work through one block at a time and keep the phone on this screen.</p>
          </div>
          <div className="progress-pill">
            <strong>{progressLabel}</strong>
            <span>completed</span>
          </div>
        </div>

        <div className="focus-progress-bar" aria-hidden="true">
          <span style={{ width: `${(completedCount / Math.max(totalCount, 1)) * 100}%` }} />
        </div>

        <div className="focus-block-list">
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
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
