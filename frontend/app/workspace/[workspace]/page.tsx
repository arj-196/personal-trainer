import Link from 'next/link';
import { notFound } from 'next/navigation';

import { WorkoutBlockCard } from '@/components/workout-block-card';
import { readWorkoutPlan } from '@/lib/trainer-data';
import { buildWorkoutDayBlocks } from '@/lib/workout-helpers';

export const dynamic = 'force-dynamic';

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  const plan = await readWorkoutPlan(workspace);

  if (!plan) {
    notFound();
  }

  return (
    <main className="shell">
      <section className="hero-panel hero-panel-compact">
        <div className="hero-topline">
          <div>
            <p className="section-kicker">Focus mode</p>
            <h1 className="hero-title">{plan.title}</h1>
          </div>
          <div className="hero-avatar" aria-hidden="true">FM</div>
        </div>
        <p className="hero-subtitle">
          A clean read-only view of the full plan with the same mobile card system used in the workout flow.
        </p>
        <div className="hero-actions">
          <Link className="soft-action" href={`/?workspace=${workspace}`}>
            Back to dashboard
          </Link>
        </div>
      </section>

      <section className="panel-card">
        <div className="day-list">
          {plan.days.map((day, index) => (
            <article key={day.heading} className="day-showcase">
              <div className="day-showcase-head">
                <div>
                  <p className="section-kicker">Workout day</p>
                  <h2 className="day-title">{day.heading}</h2>
                </div>
                <Link className="day-start-link" href={`/workspace/${workspace}/start?day=${index + 1}`}>
                  Start workout
                </Link>
              </div>
              <div className="workout-block-grid">
                {buildWorkoutDayBlocks(day).map((block) => (
                  <WorkoutBlockCard key={block.id} block={block} />
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
