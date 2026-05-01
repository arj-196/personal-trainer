import Link from 'next/link';
import { notFound } from 'next/navigation';

import { StartWorkoutView } from '@/components/start-workout-view';
import { readWorkoutPlan } from '@/lib/trainer-data';

export const dynamic = 'force-dynamic';

const shellClass = 'mx-auto w-full max-w-6xl px-4 pb-8 pt-4 sm:px-6 sm:pt-5';
const heroClass = 'rounded-[1.75rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(34,184,199,0.22),transparent_35%),linear-gradient(160deg,#15171c_0%,#21252d_65%,#191d24_100%)] p-5 text-white shadow-[0_22px_60px_rgba(20,24,30,0.16)] sm:p-6';
const kickerClass = 'mb-2 text-xs font-bold uppercase tracking-[0.16em] text-white/80';
const heroTitleClass = 'm-0 max-w-[14ch] font-["Avenir_Next_Condensed","Arial_Narrow",sans-serif] leading-[0.95] tracking-[-0.03em] text-[clamp(2rem,10vw,3.4rem)]';
const primaryActionClass = 'inline-flex min-h-11 items-center justify-center rounded-full border border-transparent bg-gradient-to-br from-white to-[#ffe2d6] px-4 py-2.5 text-sm font-bold text-slate-900 transition hover:-translate-y-0.5';
const softActionClass = 'inline-flex min-h-11 items-center justify-center rounded-full border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-bold text-white transition hover:-translate-y-0.5';

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
    <main className={shellClass}>
      <section className={heroClass}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className={kickerClass}>Start workout</p>
            <h1 className={heroTitleClass}>{plan.title}</h1>
          </div>
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#ff6359] to-[#ff855d] text-sm font-extrabold tracking-[0.08em] text-white">GO</div>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/74">
          Use this page during the session for {selectedDay.heading}. Each block can be checked off and the progress stays on this device.
        </p>
        <div className="mt-4 flex flex-wrap gap-2.5">
          <Link className={primaryActionClass} href={`/?workspace=${workspace}`}>
            Back to dashboard
          </Link>
          <Link className={softActionClass} href={`/workout/${workspace}`}>
            Workout overview
          </Link>
        </div>
      </section>

      <div className="mt-4">
        <StartWorkoutView day={selectedDay} workspace={workspace} />
      </div>
    </main>
  );
}
