'use client';

import { useEffect, useState } from 'react';

import { readWorkoutProgress } from '@/lib/workout-progress';
import { Chip } from '@/components/ui';

/** "✓ done" / "n/N blocks" chip for a Workout Day — progress lives in localStorage. */
export function DayProgressChip({
  workspace,
  dayHeading,
  blockCount,
}: {
  workspace: string;
  dayHeading: string;
  blockCount: number;
}) {
  const [completedCount, setCompletedCount] = useState<number | null>(null);

  useEffect(() => {
    setCompletedCount(readWorkoutProgress(workspace, dayHeading).length);
  }, [workspace, dayHeading]);

  if (completedCount === null || completedCount === 0) {
    return null;
  }

  if (completedCount >= blockCount) {
    return <Chip tone="teal" className="font-bold">✓ done</Chip>;
  }

  return (
    <Chip tone="teal" className="font-bold">
      {completedCount}/{blockCount} blocks
    </Chip>
  );
}
