'use client';

import { useEffect, useState } from 'react';

import { readWorkoutProgress } from '@/lib/workout-progress';
import { ButtonLink, Display } from '@/components/ui';

export type TodayDaySummary = {
  dayNumber: number;
  heading: string;
  blockCount: number;
};

/**
 * Home "Today" card: shows the Active Workspace's plan and the next Workout
 * Day that still has unfinished blocks (progress lives in localStorage, so
 * this piece must run client-side).
 */
export function TodayCard({
  workspace,
  planTitle,
  metaShort,
  nextCheckIn,
  days,
}: {
  workspace: string;
  planTitle: string;
  metaShort: string;
  nextCheckIn: string;
  days: TodayDaySummary[];
}) {
  const [nextDay, setNextDay] = useState<TodayDaySummary | null>(days[0] ?? null);

  useEffect(() => {
    const firstIncomplete = days.find(
      (day) => readWorkoutProgress(workspace, day.heading).length < day.blockCount,
    );
    setNextDay(firstIncomplete ?? days[0] ?? null);
  }, [workspace, days]);

  return (
    <div className="flex flex-col gap-2.5 rounded-[20px] bg-ink p-[18px] text-onink">
      <div className="flex items-baseline justify-between gap-2">
        <Display as="div" className="text-[20px]">
          {planTitle}
        </Display>
        {metaShort ? (
          <div className="whitespace-nowrap text-[11px] opacity-70">{metaShort}</div>
        ) : null}
      </div>
      {nextDay ? (
        <div className="text-[13px] leading-relaxed opacity-75">
          Next up: {nextDay.heading}. {nextCheckIn}
        </div>
      ) : null}
      <div className="flex gap-2">
        {nextDay ? (
          <ButtonLink
            variant="accent"
            className="flex-1 font-display text-[14px]"
            href={`/workout/${encodeURIComponent(workspace)}/start?day=${nextDay.dayNumber}`}
          >
            Start Day {nextDay.dayNumber} →
          </ButtonLink>
        ) : null}
        <ButtonLink
          variant="outline"
          className="border-onink/30 text-onink"
          href={`/workout/${encodeURIComponent(workspace)}`}
        >
          Plan
        </ButtonLink>
      </div>
    </div>
  );
}
