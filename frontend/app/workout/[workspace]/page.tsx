import Link from 'next/link';
import { notFound } from 'next/navigation';

import { readWorkoutPlan } from '@/lib/trainer-data';

export const dynamic = 'force-dynamic';

export default async function WorkoutPage({
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
            <p className="section-kicker">Workout overview</p>
            <h1 className="hero-title">{plan.title}</h1>
          </div>
          <div className="hero-avatar" aria-hidden="true">WK</div>
        </div>
        <p className="hero-subtitle">
          Review each training day before you start. This page stays intentionally light so the detailed cues
          only show up once you enter the session view.
        </p>
        <div className="hero-actions">
          <Link className="soft-action" href={`/?workspace=${workspace}`}>
            Back to dashboard
          </Link>
          <Link className="primary-action" href={`/workout/${workspace}/start`}>
            Start today&apos;s workout
          </Link>
        </div>
      </section>

      <section className="panel-card">
        <div className="day-list">
          {plan.days.map((day, index) => (
            <article key={day.heading} className="day-showcase workout-day-summary">
              <div className="day-showcase-head">
                <div>
                  <p className="section-kicker">Workout day</p>
                  <h2 className="day-title">{day.heading}</h2>
                </div>
                <Link className="day-start-link" href={`/workout/${workspace}/start?day=${index + 1}`}>
                  Start workout
                </Link>
              </div>

              <div className="detail-list workout-day-summary-list">
                <section className="detail-section">
                  <span className="detail-label">Warm-up</span>
                  <p className="section-copy">{day.warmup}</p>
                </section>

                <section className="detail-section">
                  <span className="detail-label">Exercises</span>
                  <ul className="summary-exercise-list">
                    {day.exercises.map((exercise) => (
                      <li key={`${day.heading}-${exercise.name}`}>{exercise.name}</li>
                    ))}
                  </ul>
                </section>

                {day.finisher ? (
                  <section className="detail-section">
                    <span className="detail-label">Finisher</span>
                    <p className="section-copy">{day.finisher}</p>
                  </section>
                ) : null}

                {day.recovery ? (
                  <section className="detail-section">
                    <span className="detail-label">Recovery</span>
                    <p className="section-copy">{day.recovery}</p>
                  </section>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
