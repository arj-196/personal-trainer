import Link from 'next/link';
import { notFound } from 'next/navigation';

import { readWorkoutPlan, workspaceImageUrl } from '@/lib/trainer-data';

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
      <section className="hero">
        <span className="hero-eyebrow">Focus Mode</span>
        <h1 className="hero-title">{plan.title}</h1>
        <p className="hero-subtitle">
          A cleaner, larger workout view for moving through your session on one screen.
        </p>
        <div className="hero-links">
          <Link className="chip-link" href={`/?workspace=${workspace}`}>
            Back to dashboard
          </Link>
          <Link className="chip-link" href={`/recipes?workspace=${workspace}`}>
            Recipes
          </Link>
          <Link className="chip-link" href="/library">
            Exercise Library
          </Link>
        </div>
      </section>

      <section className="panel panel-spaced">
        <div className="day-stack">
          {plan.days.map((day) => (
            <article key={day.heading} className="day-card">
              <h2 className="day-title">{day.heading}</h2>
              <p className="day-subtext">
                <strong>Warm-up:</strong> {day.warmup}
              </p>
              <div className="exercise-grid">
                {day.exercises.map((exercise) => (
                  <article key={`${day.heading}-${exercise.name}`} className="exercise-card">
                    {exercise.imagePath ? (
                      <img
                        className="exercise-image"
                        src={workspaceImageUrl(workspace, exercise.imagePath) ?? ''}
                        alt={exercise.name}
                      />
                    ) : null}
                    <div className="exercise-body">
                      <h3 className="exercise-name">{exercise.name}</h3>
                      <p className="exercise-prescription">{exercise.prescription}</p>
                      <p className="exercise-meta">{exercise.notes}</p>
                    </div>
                  </article>
                ))}
              </div>
              <div className="badge-row">
                <span className="badge">Finisher: {day.finisher}</span>
                <span className="badge">Recovery: {day.recovery}</span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
