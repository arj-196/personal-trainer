'use client';

import { useEffect, useState } from 'react';

import type { WorkoutDay } from '@/lib/trainer-data';
import { buildWorkoutDayBlocks } from '@/lib/workout-helpers';
import {
  readWorkoutProgress,
  toggleWorkoutBlock,
  writeWorkoutProgress,
} from '@/lib/workout-progress';

import { WorkoutBlockCard } from './workout-block-card';

type StartWorkoutViewProps = {
  day: WorkoutDay;
  workspace: string;
};

export function StartWorkoutView({ day, workspace }: StartWorkoutViewProps) {
  const blocks = buildWorkoutDayBlocks(day);
  const [completedIds, setCompletedIds] = useState<string[]>([]);

  useEffect(() => {
    setCompletedIds(readWorkoutProgress(workspace, day.heading));
  }, [workspace, day.heading]);

  useEffect(() => {
    writeWorkoutProgress(workspace, day.heading, completedIds);
  }, [workspace, day.heading, completedIds]);

  const completedCount = completedIds.length;
  const totalCount = blocks.length;
  const progressLabel = `${completedCount}/${totalCount}`;

  return (
    <section className="panel-stack">
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
