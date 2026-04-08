import Link from 'next/link';

import { readExerciseLibrary } from '@/lib/trainer-data';

export const dynamic = 'force-dynamic';

const shellClass = 'mx-auto w-full max-w-6xl px-4 pb-8 pt-4 sm:px-6 sm:pt-5';
const heroClass = 'rounded-[1.75rem] border border-white/70 bg-[linear-gradient(150deg,rgba(255,255,255,0.94),rgba(255,244,234,0.9)),linear-gradient(180deg,#fff,#f6f0e8)] p-5 shadow-[0_20px_45px_rgba(41,51,64,0.08)] backdrop-blur-xl sm:p-6';
const cardClass = 'mt-4 rounded-[1.75rem] border border-white/70 bg-white/80 p-5 shadow-[0_20px_45px_rgba(41,51,64,0.08)] backdrop-blur-xl sm:p-6';
const kickerClass = 'mb-2 text-xs font-bold uppercase tracking-[0.16em] text-[#ff6359]';
const titleClass = 'm-0 font-["Avenir_Next_Condensed","Arial_Narrow",sans-serif] leading-[0.95] tracking-[-0.03em] text-[clamp(2rem,10vw,3.4rem)]';
const sectionTitleClass = 'm-0 font-["Avenir_Next_Condensed","Arial_Narrow",sans-serif] leading-none tracking-[-0.03em] text-[clamp(1.5rem,5vw,2.15rem)]';
const copyClass = 'm-0 text-sm leading-relaxed text-slate-500';
const softActionClass = 'inline-flex min-h-11 items-center justify-center rounded-full border border-slate-300/60 bg-white/75 px-4 py-2.5 text-sm font-bold text-slate-800 transition hover:-translate-y-0.5';
const primaryActionClass = 'inline-flex min-h-11 items-center justify-center rounded-full border border-transparent bg-gradient-to-br from-[#ff6a60] to-[#ff7f5d] px-4 py-2.5 text-sm font-bold text-white shadow-[0_12px_24px_rgba(255,99,89,0.24)] transition hover:-translate-y-0.5';

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim().toLowerCase() ?? '';
  const allExercises = await readExerciseLibrary();
  const exercises = query
    ? allExercises.filter((exercise) => {
        const haystack = [exercise.name, exercise.summary, ...exercise.aliases, ...exercise.cues]
          .join(' ')
          .toLowerCase();
        return haystack.includes(query);
      })
    : allExercises;

  return (
    <main className={shellClass}>
      <section className={heroClass}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className={kickerClass}>Exercise library</p>
            <h1 className={titleClass}>Movement references that are actually usable.</h1>
          </div>
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-gradient-to-br from-white/95 to-slate-100/90 text-sm font-extrabold tracking-[0.08em] text-slate-800 shadow-[0_12px_24px_rgba(43,52,61,0.1)]">EX</div>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-500">
          Browse the trainer&apos;s exercise library, see the image reference, and use the setup and cue notes
          when you forget what a movement means in the middle of training.
        </p>
        <div className="mt-4 flex flex-wrap gap-2.5">
          <Link className={primaryActionClass} href="/">
            Current workout
          </Link>
          <Link className={softActionClass} href="/recipes">
            Recipes
          </Link>
        </div>
      </section>

      <section className={cardClass}>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className={sectionTitleClass}>{exercises.length} exercise references</h2>
            <p className={copyClass}>Use the query string like <code>?q=squat</code> to filter.</p>
          </div>
          {query ? (
            <Link className={softActionClass} href="/library">
              Clear filter
            </Link>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {exercises.map((exercise) => (
            <article key={exercise.slug} className="overflow-hidden rounded-[1.5rem] border border-white/70 bg-gradient-to-b from-white/96 to-slate-50/90 shadow-[0_10px_28px_rgba(43,52,61,0.08)]">
              <img
                className="aspect-[16/11] h-full w-full object-cover"
                src={exercise.image_url}
                alt={exercise.name}
              />
              <div className="grid gap-3 p-4">
                <h3 className="m-0 font-[Avenir_Next_Condensed,Arial_Narrow,sans-serif] text-[1.4rem] leading-none tracking-[-0.03em]">{exercise.name}</h3>
                <p className={copyClass}>{exercise.summary}</p>
                <div className="grid gap-3">
                  <section className="border-t border-slate-200/70 pt-3">
                    <span className="mb-1 block text-[0.72rem] uppercase tracking-[0.1em] text-slate-500">Setup</span>
                    <p className={copyClass}>{exercise.setup}</p>
                  </section>
                  <section className="border-t border-slate-200/70 pt-3">
                    <span className="mb-1 block text-[0.72rem] uppercase tracking-[0.1em] text-slate-500">Coaching Cues</span>
                    <ul className="m-0 list-disc pl-5 text-sm leading-relaxed text-slate-600">
                      {exercise.cues.map((cue) => (
                        <li key={cue}>{cue}</li>
                      ))}
                    </ul>
                  </section>
                  {exercise.visual_note ? (
                    <section className="border-t border-slate-200/70 pt-3">
                      <span className="mb-1 block text-[0.72rem] uppercase tracking-[0.1em] text-slate-500">Visual Note</span>
                      <p className={copyClass}>{exercise.visual_note}</p>
                    </section>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center rounded-full bg-[#ff6359]/12 px-3 py-1.5 text-xs font-bold text-[#b54843]">{exercise.license}</span>
                  <span className="inline-flex items-center rounded-full bg-[#ff6359]/12 px-3 py-1.5 text-xs font-bold text-[#b54843]">{exercise.author || 'Unknown author'}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
