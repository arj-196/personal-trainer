import Link from 'next/link';

import {
  getCurrentCommitHash,
  getCurrentEnvVariables,
  getHeaderCommitId,
  isDebugEnabled,
} from '@/lib/debug-info';
import {
  listWorkspaces,
  readWorkoutPlan,
  workspaceImageUrl,
} from '@/lib/trainer-data';

export const dynamic = 'force-dynamic';

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ workspace?: string }>;
}) {
  const params = await searchParams;
  const workspaces = await listWorkspaces();
  const showDebugPanel = isDebugEnabled();
  const headerCommitId = getHeaderCommitId();
  const debugCommitHash = showDebugPanel ? getCurrentCommitHash() : null;
  const debugEnvVars = showDebugPanel ? getCurrentEnvVariables() : [];
  const selectedWorkspace =
    params.workspace && workspaces.includes(params.workspace)
      ? params.workspace
      : workspaces[0];
  const plan = selectedWorkspace ? await readWorkoutPlan(selectedWorkspace) : null;

  return (
    <main className="shell">
      <section className="hero">
        <span className="hero-eyebrow">
          Personal Trainer
          {headerCommitId ? <code className="hero-commit">{headerCommitId}</code> : null}
        </span>
        <p className="hero-subtitle">
          Read the active plan from your trainer workspace, move through each day,
          and jump to the exercise library when you need a movement refresher.
        </p>
        <div className="hero-links">
          <Link className="chip-link active" href={selectedWorkspace ? `/?workspace=${selectedWorkspace}` : '/'}>
            Workout View
          </Link>
          <Link className="chip-link" href={selectedWorkspace ? `/recipes?workspace=${selectedWorkspace}` : '/recipes'}>
            Recipes
          </Link>
          <Link className="chip-link" href="/library">
            Exercise Library
          </Link>
        </div>
      </section>

      {showDebugPanel ? (
        <section className="panel panel-spaced debug-panel">
          <div className="section-head">
            <div>
              <h2 className="section-title">Debug</h2>
              <p className="section-copy">Server-side runtime details for the current page render.</p>
            </div>
          </div>
          <div className="debug-stack">
            <div className="text-block">
              <strong>Current Git Commit Hash</strong>
              <p className="debug-hash">{debugCommitHash}</p>
            </div>
            <div className="text-block">
              <strong>Current Environment Variables</strong>
              <div className="debug-env-list">
                {debugEnvVars.map((item) => (
                  <div key={item.key} className="debug-env-item">
                    <code>{item.key}</code>
                    <code>{item.value}</code>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {workspaces.length === 0 ? (
        <section className="empty-state">
          <h2 className="section-title">No workspaces yet</h2>
          <p>
            Create one from the trainer CLI with <code>personal-trainer init &lt;name&gt;</code>,
            then generate a plan and refresh this page.
          </p>
        </section>
      ) : (
        <div className="content-grid">
          <aside className="sidebar">
            <h2 className="sidebar-title">Workspaces</h2>
            <div className="sidebar-stack">
              {workspaces.map((workspace) => (
                <Link
                  key={workspace}
                  className={`workspace-link ${workspace === selectedWorkspace ? 'active' : ''}`}
                  href={`/?workspace=${workspace}`}
                >
                  {workspace}
                </Link>
              ))}
            </div>
          </aside>

          {plan ? (
            <section className="panel">
              <div className="section-head">
                <div>
                  <h2 className="section-title">{plan.title}</h2>
                  <p className="section-copy">
                    Workspace <strong>{selectedWorkspace}</strong>
                  </p>
                </div>
                <Link className="chip-link" href={`/workspace/${selectedWorkspace}`}>
                  Focus Mode
                </Link>
              </div>

              <div className="stat-grid">
                {plan.meta.map((item) => (
                  <article key={item.label} className="stat">
                    <span className="stat-label">{item.label}</span>
                    <span className="stat-value">{item.value}</span>
                  </article>
                ))}
              </div>

              <div className="text-grid">
                <div className="text-block">
                  <strong>Summary</strong>
                  <p>{plan.summary}</p>
                </div>
                <div className="text-block">
                  <strong>Progression</strong>
                  <p>{plan.progression}</p>
                </div>
              </div>

              <div className="day-stack">
                {plan.days.map((day) => (
                  <article key={day.heading} className="day-card">
                    <h3 className="day-title">{day.heading}</h3>
                    <p className="day-subtext">
                      <strong>Warm-up:</strong> {day.warmup}
                    </p>
                    <div className="exercise-grid">
                      {day.exercises.map((exercise) => (
                        <article key={`${day.heading}-${exercise.name}`} className="exercise-card">
                          {exercise.imagePath ? (
                            <img
                              className="exercise-image"
                              src={workspaceImageUrl(selectedWorkspace!, exercise.imagePath) ?? ''}
                              alt={exercise.name}
                            />
                          ) : null}
                          <div className="exercise-body">
                            <h4 className="exercise-name">{exercise.name}</h4>
                            <p className="exercise-prescription">{exercise.prescription}</p>
                            <p className="exercise-meta">{exercise.notes}</p>
                            {exercise.referencePath ? (
                              <div className="badge-row">
                                <Link className="badge" href="/library">
                                  Open in library
                                </Link>
                              </div>
                            ) : null}
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

              <div className="text-block">
                <strong>Next Check-In</strong>
                <p>{plan.nextCheckIn}</p>
              </div>
            </section>
          ) : (
            <section className="empty-state">
              <h2 className="section-title">No plan yet</h2>
              <p>
                The selected workspace exists, but <code>plan.json</code> is missing.
                Run <code>personal-trainer plan {selectedWorkspace}</code> in the trainer app.
              </p>
            </section>
          )}
        </div>
      )}
    </main>
  );
}
