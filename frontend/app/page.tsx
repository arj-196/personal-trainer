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

const shellClass = 'mx-auto w-full max-w-6xl px-4 pb-8 pt-4 sm:px-6 sm:pt-5';
const cardClass = 'rounded-[1.75rem] border border-white/70 bg-white/80 p-5 shadow-[0_20px_45px_rgba(41,51,64,0.08)] backdrop-blur-xl sm:p-6';
const sectionHeadClass = 'flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between';
const sectionTitleClass = 'm-0 font-["Avenir_Next_Condensed","Arial_Narrow",sans-serif] text-3xl leading-none tracking-[-0.03em]';
const sectionCopyClass = 'm-0 text-sm leading-relaxed text-slate-500';
const sectionKickerClass = 'mb-2 text-xs font-bold uppercase tracking-[0.16em] text-[#ff6359]';
const softActionClass = 'inline-flex min-h-11 items-center justify-center rounded-full border border-slate-300/60 bg-white/75 px-4 py-2.5 text-sm font-bold text-slate-800 transition hover:-translate-y-0.5';
const primaryActionClass = 'inline-flex min-h-11 items-center justify-center rounded-full border border-transparent bg-gradient-to-br from-[#ff6a60] to-[#ff7f5d] px-4 py-2.5 text-sm font-bold text-white shadow-[0_12px_24px_rgba(255,99,89,0.24)] transition hover:-translate-y-0.5';

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
    <main className={shellClass}>
      {showDebugPanel ? (
        <section className={`${cardClass} mb-4`}>
          <div className={sectionHeadClass}>
            <div>
              <h2 className={sectionTitleClass}>Debug</h2>
              <p className={sectionCopyClass}>Server-side runtime details for the current page render.</p>
            </div>
          </div>
          <div className="mt-4 grid gap-4">
            <div className="rounded-3xl border border-slate-200/60 bg-white/80 p-4">
              <strong className="mb-1 block">Current Git Commit Hash</strong>
              <p className="m-0 break-all font-mono text-sm text-slate-500">{debugCommitHash}</p>
            </div>
            <div className="rounded-3xl border border-slate-200/60 bg-white/80 p-4">
              <strong className="mb-2 block">Current Environment Variables</strong>
              <div className="grid gap-2">
                {debugEnvVars.map((item) => (
                  <div key={item.key} className="grid gap-2 rounded-2xl border border-slate-200/60 bg-white/80 p-3">
                    <code className="text-xs break-all">{item.key}</code>
                    <code className="text-xs break-all">{item.value}</code>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {workspaces.length === 0 ? (
        <section className={cardClass}>
          <h2 className={sectionTitleClass}>No workspaces yet</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Create one from the trainer CLI with <code>personal-trainer init &lt;name&gt;</code>,
            then generate a plan and refresh this page.
          </p>
        </section>
      ) : (
        <div className="grid gap-4 sm:gap-5">
          <section className={cardClass}>
            <div className={sectionHeadClass}>
              <div>
                <p className={sectionKickerClass}>Workspace</p>
                <h2 className={sectionTitleClass}>Pick your active plan</h2>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 overflow-x-auto pb-1">
              {workspaces.map((workspace) => (
                <Link
                  key={workspace}
                  className={[
                    'inline-flex min-h-11 items-center justify-center rounded-full border px-4 py-2.5 text-sm font-bold transition hover:-translate-y-0.5',
                    workspace === selectedWorkspace
                      ? 'border-transparent bg-slate-900 text-white'
                      : 'border-slate-300/60 bg-white/75 text-slate-800',
                  ].join(' ')}
                  href={`/?workspace=${workspace}`}
                >
                  {workspace}
                </Link>
              ))}
            </div>
          </section>
          {plan ? (
            <section className={cardClass}>
              <div className={sectionHeadClass}>
                <div>
                  <p className={sectionKickerClass}>Current plan</p>
                  <h2 className={sectionTitleClass}>{plan.title}</h2>
                  <p className={sectionCopyClass}>Workspace <strong>{selectedWorkspace}</strong></p>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  <Link className={primaryActionClass} href={`/workout/${selectedWorkspace}`}>
                    Open workout
                  </Link>
                  <Link className={softActionClass} href={`/workout/${selectedWorkspace}/start`}>
                    Start session
                  </Link>
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.8fr)_minmax(280px,1fr)]">
                <div className="grid gap-3 rounded-[1.5rem] border border-slate-200/70 bg-gradient-to-b from-white/90 to-slate-50/80 p-4">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {plan.meta.map((item, index) => (
                      <article
                        key={item.label}
                        className={[
                          'rounded-3xl border border-white/80 p-3',
                          index % 3 === 1
                            ? 'bg-gradient-to-b from-amber-100/70 to-white/90'
                            : index % 3 === 2
                              ? 'bg-gradient-to-b from-violet-100/70 to-white/90'
                              : 'bg-gradient-to-b from-cyan-100/70 to-white/90',
                        ].join(' ')}
                      >
                        <span className="block text-[0.72rem] uppercase tracking-[0.1em] text-slate-500">{item.label}</span>
                        <span className="mt-1 block text-base font-bold leading-tight">{item.value}</span>
                      </article>
                    ))}
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-4">
                      <strong className="mb-1 block">Summary</strong>
                      <p className="m-0 text-sm leading-relaxed text-slate-600">{plan.summary}</p>
                    </div>
                    <div className="rounded-3xl border border-slate-200/70 bg-gradient-to-b from-cyan-100/65 to-white/85 p-4">
                      <strong className="mb-1 block">Progression</strong>
                      <p className="m-0 text-sm leading-relaxed text-slate-600">{plan.progression}</p>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-4">
                    <strong className="mb-1 block">Next Check-In</strong>
                    <p className="m-0 text-sm leading-relaxed text-slate-600">{plan.nextCheckIn}</p>
                  </div>
                </div>

                <aside className="grid content-start gap-3 rounded-[1.5rem] border border-slate-200/70 bg-[radial-gradient(circle_at_top_right,rgba(34,184,199,0.12),transparent_35%),linear-gradient(180deg,rgba(255,241,218,0.75),rgba(255,255,255,0.92))] p-4">
                  <p className={sectionKickerClass}>Recipes</p>
                  <h3 className={sectionTitleClass}>Jeff the Cook is ready for voice-led recipe runs.</h3>
                  <p className={sectionCopyClass}>
                    Speak ingredients and constraints, review the draft workspace, then generate and save three
                    recipe options.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center rounded-full bg-[#ff6359]/12 px-3 py-1.5 text-xs font-bold text-[#b54843]">Voice-first</span>
                    <span className="inline-flex items-center rounded-full bg-[#ff6359]/12 px-3 py-1.5 text-xs font-bold text-[#b54843]">Draft review</span>
                    <span className="inline-flex items-center rounded-full bg-[#ff6359]/12 px-3 py-1.5 text-xs font-bold text-[#b54843]">Blob snapshots</span>
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    <Link className={primaryActionClass} href="/recipes">
                      Open Jeff the Cook
                    </Link>
                  </div>
                </aside>
              </div>
            </section>
          ) : (
            <section className={cardClass}>
              <h2 className={sectionTitleClass}>No plan yet</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                The selected workspace exists, but <code>plan.json</code> is missing.
                Run <code>personal-trainer plan {selectedWorkspace}</code> in the trainer app.
              </p>
              <div className="mt-4 grid gap-4">
                <aside className="grid content-start gap-3 rounded-[1.5rem] border border-slate-200/70 bg-[radial-gradient(circle_at_top_right,rgba(34,184,199,0.12),transparent_35%),linear-gradient(180deg,rgba(255,241,218,0.75),rgba(255,255,255,0.92))] p-4">
                  <p className={sectionKickerClass}>Recipes</p>
                  <h3 className={sectionTitleClass}>Jeff the Cook still works without a generated plan.</h3>
                  <p className={sectionCopyClass}>
                    Open the recipe workspace directly, speak your ingredients, and save snapshots independently
                    from the trainer flow.
                  </p>
                  <div className="flex flex-wrap gap-2.5">
                    <Link className={primaryActionClass} href="/recipes">
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
