import Link from 'next/link';
import { notFound } from 'next/navigation';

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
    <main className="shell">
      <section className="hero-panel hero-panel-dark">
        <div className="hero-topline">
          <div>
            <p className="section-kicker section-kicker-on-dark">Start workout</p>
            <h1 className="hero-title hero-title-on-dark">{plan.title}</h1>
          </div>
          <div className="hero-avatar hero-avatar-accent" aria-hidden="true">GO</div>
        </div>
        <p className="hero-subtitle hero-subtitle-on-dark">
          Use this page during the session for {selectedDay.heading}. Each block can be checked off and the progress stays on this device.
        </p>
        <div className="hero-actions">
          <Link className="primary-action primary-action-bright" href={`/?workspace=${workspace}`}>
            Back to dashboard
          </Link>
          <Link className="soft-action soft-action-dark" href={`/workspace/${workspace}`}>
            Read-only focus mode
          </Link>
        </div>
      </section>

      <StartWorkoutView day={selectedDay} workspace={workspace} />
    </main>
  );
}
