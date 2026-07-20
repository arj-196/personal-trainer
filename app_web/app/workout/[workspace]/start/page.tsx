import { notFound } from 'next/navigation';

import { RememberWorkspace } from '@/components/remember-workspace';
import { StartWorkoutView } from '@/components/start-workout-view';
import { readWorkoutPlan } from '@/lib/trainer-data';

export const dynamic = 'force-dynamic';

export default async function StartWorkoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string }>;
  searchParams: Promise<{ day?: string }>;
}) {
  const { workspace } = await params;
  const { day } = await searchParams;
  const plan = await readWorkoutPlan(workspace);

  if (!plan || plan.days.length === 0) {
    notFound();
  }

  const requestedDay = Number.parseInt(day ?? '1', 10);
  const selectedDayIndex =
    Number.isFinite(requestedDay) && requestedDay >= 1 && requestedDay <= plan.days.length
      ? requestedDay - 1
      : 0;
  const selectedDay = plan.days[selectedDayIndex];

  return (
    <>
      <RememberWorkspace slug={workspace} />
      <StartWorkoutView day={selectedDay} workspace={workspace} />
    </>
  );
}
