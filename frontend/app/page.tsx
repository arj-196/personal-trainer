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
      {showDebugPanel ? (
        <section className="panel-card debug-panel">
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
        <div className="panel-stack">
          <section className="panel-card">
            <div className="section-head">
              <div>
                <p className="section-kicker">Workspace</p>
                <h2 className="section-title">Pick your active plan</h2>
              </div>
            </div>
            <div className="workspace-strip">
              {workspaces.map((workspace) => (
                <Link
                  key={workspace}
                  className={`workspace-chip ${workspace === selectedWorkspace ? 'active' : ''}`}
                  href={`/?workspace=${workspace}`}
                >
                  {workspace}
                </Link>
              ))}
            </div>
          </section>
          {plan ? (
            <section className="panel-card">
              <div className="section-head panel-head">
                <div>
                  <p className="section-kicker">Current plan</p>
                  <h2 className="section-title">{plan.title}</h2>
                  <p className="section-copy">Workspace <strong>{selectedWorkspace}</strong></p>
                </div>
                <div className="hero-actions">
                  <Link className="primary-action" href={`/workout/${selectedWorkspace}`}>
                    Open workout
                  </Link>
                  <Link className="soft-action" href={`/workout/${selectedWorkspace}/start`}>
                    Start session
                  </Link>
                </div>
              </div>

              <div className="homepage-feature-grid">
                <div className="homepage-feature-card homepage-feature-card-primary">
                  <div className="stat-tile-grid">
                    {plan.meta.map((item) => (
                      <article key={item.label} className="stat-tile">
                        <span className="stat-label">{item.label}</span>
                        <span className="stat-value">{item.value}</span>
                      </article>
                    ))}
                  </div>

                  <div className="story-grid">
                    <div className="story-card">
                      <strong>Summary</strong>
                      <p>{plan.summary}</p>
                    </div>
                    <div className="story-card story-card-soft">
                      <strong>Progression</strong>
                      <p>{plan.progression}</p>
                    </div>
                  </div>

                  <div className="story-card">
                    <strong>Next Check-In</strong>
                    <p>{plan.nextCheckIn}</p>
                  </div>
                </div>

                <aside className="homepage-feature-card homepage-feature-card-recipes">
                  <p className="section-kicker">Recipes</p>
                  <h3 className="section-title">Jeff the Cook is ready for voice-led recipe runs.</h3>
                  <p className="section-copy">
                    Speak ingredients and constraints, review the draft workspace, then generate and save three
                    recipe options.
                  </p>
                  <div className="badge-row">
                    <span className="badge">Voice-first</span>
                    <span className="badge">Draft review</span>
                    <span className="badge">Blob snapshots</span>
                  </div>
                  <div className="hero-actions">
                    <Link className="primary-action" href="/recipes">
                      Open Jeff the Cook
                    </Link>
                  </div>
                </aside>
              </div>
            </section>
          ) : (
            <section className="empty-state">
              <h2 className="section-title">No plan yet</h2>
              <p>
                The selected workspace exists, but <code>plan.json</code> is missing.
                Run <code>personal-trainer plan {selectedWorkspace}</code> in the trainer app.
              </p>
              <div className="homepage-feature-grid homepage-feature-grid-single">
                <aside className="homepage-feature-card homepage-feature-card-recipes">
                  <p className="section-kicker">Recipes</p>
                  <h3 className="section-title">Jeff the Cook still works without a generated plan.</h3>
                  <p className="section-copy">
                    Open the recipe workspace directly, speak your ingredients, and save snapshots independently
                    from the trainer flow.
                  </p>
                  <div className="hero-actions">
                    <Link className="primary-action" href="/recipes">
                      Open Jeff the Cook
                    </Link>
                  </div>
                </aside>
              </div>
            </section>
          )}
        </div>
      )}
    </main>
  );
}
