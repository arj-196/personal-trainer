import Link from 'next/link';
import { notFound } from 'next/navigation';

import { saveCheckInAction, saveProfileAction } from '../../actions';
import { WorkoutGenerationPanel } from '@/components/workout-generation-panel';
import { listCheckIns, readAthleteProfile, readWorkoutPlan } from '@/lib/server/workspaces';

export const dynamic = 'force-dynamic';

const shellClass = 'mx-auto w-full max-w-6xl px-4 pb-8 pt-4 sm:px-6 sm:pt-5';
const cardClass = 'rounded-[1.75rem] border border-white/70 bg-white/80 p-5 shadow-[0_20px_45px_rgba(41,51,64,0.08)] backdrop-blur-xl sm:p-6';
const sectionTitleClass = 'm-0 font-["Avenir_Next_Condensed","Arial_Narrow",sans-serif] text-[clamp(1.5rem,5vw,2.3rem)] leading-none tracking-[-0.03em]';
const fieldClass = 'rounded-2xl border border-slate-300/70 px-4 py-3';
const textAreaClass = 'min-h-28 rounded-2xl border border-slate-300/70 px-4 py-3';

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  const [profile, checkIns, currentPlan] = await Promise.all([
    readAthleteProfile(workspace),
    listCheckIns(workspace),
    readWorkoutPlan(workspace),
  ]);

  if (!profile) {
    notFound();
  }

  const canCreateCheckIn = currentPlan !== null;

  return (
    <main className={shellClass}>
      <section className={cardClass}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-[#ff6359]">Workspace Settings</p>
            <h1 className={sectionTitleClass}>{profile.name || workspace}</h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-500">
              Complete the athlete profile for <strong>{workspace}</strong>, generate the first plan, then use
              check-ins after training to tune future plans.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Link className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-300/60 bg-white/75 px-4 py-2.5 text-sm font-bold text-slate-800 transition hover:-translate-y-0.5" href={`/?workspace=${workspace}`}>
              Dashboard
            </Link>
            <Link className="inline-flex min-h-11 items-center justify-center rounded-full border border-transparent bg-gradient-to-br from-[#ff6a60] to-[#ff7f5d] px-4 py-2.5 text-sm font-bold text-white shadow-[0_12px_24px_rgba(255,99,89,0.24)] transition hover:-translate-y-0.5" href={`/workout/${workspace}`}>
              Current Plan
            </Link>
          </div>
        </div>
      </section>

      <div className="mt-4">
        <WorkoutGenerationPanel workspace={workspace} variant={currentPlan ? 'compact' : 'empty'} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <section className={cardClass}>
          <h2 className={sectionTitleClass}>Athlete Profile</h2>
          <form action={saveProfileAction} className="mt-4 grid gap-4">
            <input type="hidden" name="workspace" value={workspace} />
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-bold text-slate-800">Name<input className={fieldClass} name="name" defaultValue={profile.name} required /></label>
              <label className="grid gap-2 text-sm font-bold text-slate-800">Goal<input className={fieldClass} name="goal" defaultValue={profile.goal} /></label>
              <label className="grid gap-2 text-sm font-bold text-slate-800">Age<input className={fieldClass} name="age" type="number" defaultValue={profile.age ?? ''} /></label>
              <label className="grid gap-2 text-sm font-bold text-slate-800">Sex<input className={fieldClass} name="sex" defaultValue={profile.sex} /></label>
              <label className="grid gap-2 text-sm font-bold text-slate-800">Height cm<input className={fieldClass} name="heightCm" type="number" defaultValue={profile.heightCm ?? ''} /></label>
              <label className="grid gap-2 text-sm font-bold text-slate-800">Weight kg<input className={fieldClass} name="weightKg" type="number" step="0.1" defaultValue={profile.weightKg ?? ''} /></label>
              <label className="grid gap-2 text-sm font-bold text-slate-800">Experience Level<input className={fieldClass} name="experienceLevel" defaultValue={profile.experienceLevel} /></label>
              <label className="grid gap-2 text-sm font-bold text-slate-800">Cardio Preference<input className={fieldClass} name="cardioPreference" defaultValue={profile.cardioPreference} /></label>
              <label className="grid gap-2 text-sm font-bold text-slate-800">Training Days<input className={fieldClass} name="trainingDays" type="number" min="1" max="7" defaultValue={profile.trainingDays} /></label>
              <label className="grid gap-2 text-sm font-bold text-slate-800">Session Minutes<input className={fieldClass} name="sessionLengthMinutes" type="number" min="20" max="180" defaultValue={profile.sessionLengthMinutes} /></label>
            </div>
            <label className="grid gap-2 text-sm font-bold text-slate-800">Equipment<textarea className={textAreaClass} name="equipment" defaultValue={profile.equipment.join('\n')} /></label>
            <label className="grid gap-2 text-sm font-bold text-slate-800">Limitations<textarea className={textAreaClass} name="limitations" defaultValue={profile.limitations.join('\n')} /></label>
            <label className="grid gap-2 text-sm font-bold text-slate-800">Preferred Focus<textarea className={textAreaClass} name="preferredFocus" defaultValue={profile.preferredFocus.join('\n')} /></label>
            <label className="grid gap-2 text-sm font-bold text-slate-800">Notes<textarea className={textAreaClass} name="notes" defaultValue={profile.notes.join('\n')} /></label>
            <button className="inline-flex min-h-11 items-center justify-center rounded-full border border-transparent bg-gradient-to-br from-[#ff6a60] to-[#ff7f5d] px-4 py-2.5 text-sm font-bold text-white shadow-[0_12px_24px_rgba(255,99,89,0.24)]" type="submit">Save Profile</button>
          </form>
        </section>

        <section className={cardClass}>
          <h2 className={sectionTitleClass}>Check-ins</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-500">
            {canCreateCheckIn
              ? 'Create a new entry or edit any previous dated check-in.'
              : 'Check-ins become available after the first workout plan has been generated and completed.'}
          </p>
          {canCreateCheckIn ? (
            <form action={saveCheckInAction} className="mt-4 grid gap-3 rounded-[1.5rem] border border-slate-200/70 bg-white/75 p-4">
              <input type="hidden" name="workspace" value={workspace} />
              <input type="hidden" name="id" value="" />
              <label className="grid gap-2 text-sm font-bold text-slate-800">Date<input className={fieldClass} name="checkInDate" type="date" required /></label>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-bold text-slate-800">Completed<input className={fieldClass} name="workoutsCompleted" type="number" defaultValue="0" /></label>
                <label className="grid gap-2 text-sm font-bold text-slate-800">Planned<input className={fieldClass} name="workoutsPlanned" type="number" defaultValue={profile.trainingDays} /></label>
                <label className="grid gap-2 text-sm font-bold text-slate-800">Difficulty<input className={fieldClass} name="averageDifficulty" type="number" min="1" max="10" defaultValue="5" /></label>
                <label className="grid gap-2 text-sm font-bold text-slate-800">Energy<input className={fieldClass} name="energy" type="number" min="1" max="10" defaultValue="5" /></label>
                <label className="grid gap-2 text-sm font-bold text-slate-800">Soreness<input className={fieldClass} name="soreness" type="number" min="1" max="10" defaultValue="3" /></label>
                <label className="grid gap-2 text-sm font-bold text-slate-800">Body Weight<input className={fieldClass} name="bodyWeightKg" type="number" step="0.1" /></label>
              </div>
              <label className="grid gap-2 text-sm font-bold text-slate-800">Wins<textarea className={textAreaClass} name="wins" /></label>
              <label className="grid gap-2 text-sm font-bold text-slate-800">Struggles<textarea className={textAreaClass} name="struggles" /></label>
              <label className="grid gap-2 text-sm font-bold text-slate-800">Notes<textarea className={textAreaClass} name="notes" /></label>
              <button className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-300/60 bg-white/75 px-4 py-2.5 text-sm font-bold text-slate-800" type="submit">Save Check-in</button>
            </form>
          ) : null}

          <div className="mt-4 grid gap-3">
            {checkIns.map((checkIn) => (
              <details key={checkIn.id} className="rounded-[1.5rem] border border-slate-200/70 bg-white/75 p-4">
                <summary className="cursor-pointer list-none font-bold text-slate-900">
                  {checkIn.checkInDate} · {checkIn.workoutsCompleted}/{checkIn.workoutsPlanned} workouts
                </summary>
                <form action={saveCheckInAction} className="mt-4 grid gap-3">
                  <input type="hidden" name="workspace" value={workspace} />
                  <input type="hidden" name="id" value={checkIn.id} />
                  <label className="grid gap-2 text-sm font-bold text-slate-800">Date<input className={fieldClass} name="checkInDate" type="date" defaultValue={checkIn.checkInDate} required /></label>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="grid gap-2 text-sm font-bold text-slate-800">Completed<input className={fieldClass} name="workoutsCompleted" type="number" defaultValue={checkIn.workoutsCompleted} /></label>
                    <label className="grid gap-2 text-sm font-bold text-slate-800">Planned<input className={fieldClass} name="workoutsPlanned" type="number" defaultValue={checkIn.workoutsPlanned} /></label>
                    <label className="grid gap-2 text-sm font-bold text-slate-800">Difficulty<input className={fieldClass} name="averageDifficulty" type="number" min="1" max="10" defaultValue={checkIn.averageDifficulty} /></label>
                    <label className="grid gap-2 text-sm font-bold text-slate-800">Energy<input className={fieldClass} name="energy" type="number" min="1" max="10" defaultValue={checkIn.energy} /></label>
                    <label className="grid gap-2 text-sm font-bold text-slate-800">Soreness<input className={fieldClass} name="soreness" type="number" min="1" max="10" defaultValue={checkIn.soreness} /></label>
                    <label className="grid gap-2 text-sm font-bold text-slate-800">Body Weight<input className={fieldClass} name="bodyWeightKg" type="number" step="0.1" defaultValue={checkIn.bodyWeightKg ?? ''} /></label>
                  </div>
                  <label className="grid gap-2 text-sm font-bold text-slate-800">Wins<textarea className={textAreaClass} name="wins" defaultValue={checkIn.wins.join('\n')} /></label>
                  <label className="grid gap-2 text-sm font-bold text-slate-800">Struggles<textarea className={textAreaClass} name="struggles" defaultValue={checkIn.struggles.join('\n')} /></label>
                  <label className="grid gap-2 text-sm font-bold text-slate-800">Notes<textarea className={textAreaClass} name="notes" defaultValue={checkIn.notes.join('\n')} /></label>
                  <button className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-300/60 bg-white/75 px-4 py-2.5 text-sm font-bold text-slate-800" type="submit">Update Check-in</button>
                </form>
              </details>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
