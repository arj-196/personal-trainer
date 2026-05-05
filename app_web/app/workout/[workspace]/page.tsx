import Link from 'next/link';
import { notFound } from 'next/navigation';

import { readWorkoutPlan } from '@/lib/trainer-data';

export const dynamic = 'force-dynamic';

const shellClass = 'mx-auto w-full max-w-6xl px-4 pb-8 pt-4 sm:px-6 sm:pt-5';
const cardClass = 'rounded-[1.75rem] border border-white/70 bg-white/80 p-5 shadow-[0_20px_45px_rgba(41,51,64,0.08)] backdrop-blur-xl sm:p-6';
const heroClass = 'relative overflow-hidden rounded-[1.75rem] border border-white/70 bg-[linear-gradient(150deg,rgba(255,255,255,0.94),rgba(255,244,234,0.9)),linear-gradient(180deg,#fff,#f6f0e8)] p-5 shadow-[0_20px_45px_rgba(41,51,64,0.08)] backdrop-blur-xl sm:p-6';
const heroTitleClass = 'm-0 max-w-[14ch] font-["Avenir_Next_Condensed","Arial_Narrow",sans-serif] leading-[0.95] tracking-[-0.03em] text-[clamp(2rem,10vw,3.4rem)]';
const kickerClass = 'mb-2 text-xs font-bold uppercase tracking-[0.16em] text-[#ff6359]';
const copyClass = 'm-0 text-sm leading-relaxed text-slate-500';
const softActionClass = 'inline-flex min-h-11 items-center justify-center rounded-full border border-slate-300/60 bg-white/75 px-4 py-2.5 text-sm font-bold text-slate-800 transition hover:-translate-y-0.5';
const primaryActionClass = 'inline-flex min-h-11 items-center justify-center rounded-full border border-transparent bg-gradient-to-br from-[#ff6a60] to-[#ff7f5d] px-4 py-2.5 text-sm font-bold text-white shadow-[0_12px_24px_rgba(255,99,89,0.24)] transition hover:-translate-y-0.5';

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
    <main className={shellClass}>
      <section className={heroClass}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className={kickerClass}>Workout overview</p>
            <h1 className={heroTitleClass}>{plan.title}</h1>
          </div>
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-gradient-to-br from-white/95 to-slate-100/90 text-sm font-extrabold tracking-[0.08em] text-slate-800 shadow-[0_12px_24px_rgba(43,52,61,0.1)]">WK</div>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-500">
          Review each training day before you start. This page stays intentionally light so the detailed cues
          only show up once you enter the session view.
        </p>
        <div className="mt-4 flex flex-wrap gap-2.5">
          <Link className={softActionClass} href={`/?workspace=${workspace}`}>
            Back to dashboard
          </Link>
          <Link className={primaryActionClass} href={`/workout/${workspace}/start`}>
            Start today&apos;s workout
          </Link>
        </div>
      </section>

      <section className={`${cardClass} mt-4`}>
        <div className="grid gap-4">
          {plan.days.map((day, index) => (
            <article key={day.heading} className="grid gap-4 rounded-[1.5rem] border border-white/70 bg-gradient-to-b from-white/95 to-slate-50/85 p-4 shadow-[0_10px_28px_rgba(43,52,61,0.08)]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className={kickerClass}>Workout day</p>
                  <h2 className="m-0 font-[Avenir_Next_Condensed,Arial_Narrow,sans-serif] text-[clamp(1.3rem,5vw,1.7rem)] leading-[1.05] tracking-[-0.03em]">{day.heading}</h2>
                </div>
                <Link
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#ff7f5d]/35 bg-gradient-to-br from-[#ff6a60]/15 to-[#ff7f5d]/20 px-4 py-2.5 text-sm font-bold text-[#b4472f] transition hover:-translate-y-0.5"
                  href={`/workout/${workspace}/start?day=${index + 1}`}
                >
                  Start workout
                </Link>
              </div>

              <div className="mt-1 grid gap-3">
                <section className="border-t border-slate-200/70 pt-3">
                  <span className="mb-1 block text-[0.72rem] uppercase tracking-[0.1em] text-slate-500">Warm-up</span>
                  <p className={copyClass}>{day.warmup}</p>
                </section>

                <section className="border-t border-slate-200/70 pt-3">
                  <span className="mb-1 block text-[0.72rem] uppercase tracking-[0.1em] text-slate-500">Exercises</span>
                  <ul className="m-0 list-disc pl-5 font-semibold leading-relaxed text-slate-900">
                    {day.exercises.map((exercise) => (
                      <li key={`${day.heading}-${exercise.name}`}>{exercise.name}</li>
                    ))}
                  </ul>
                </section>

                {day.finisher ? (
                  <section className="border-t border-slate-200/70 pt-3">
                    <span className="mb-1 block text-[0.72rem] uppercase tracking-[0.1em] text-slate-500">Finisher</span>
                    <p className={copyClass}>{day.finisher}</p>
                  </section>
                ) : null}

                {day.recovery ? (
                  <section className="border-t border-slate-200/70 pt-3">
                    <span className="mb-1 block text-[0.72rem] uppercase tracking-[0.1em] text-slate-500">Recovery</span>
                    <p className={copyClass}>{day.recovery}</p>
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
