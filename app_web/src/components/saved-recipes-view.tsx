'use client';

import Link from 'next/link';
import { useState } from 'react';

import type { SavedRecipeListItem } from '@/lib/recipes/blob-store';
import type { SavedRecipeSnapshot } from '@/lib/recipes/types';

const shellClass = 'mx-auto w-full max-w-6xl px-4 pb-8 pt-4 sm:px-6 sm:pt-5';
const heroClass = 'rounded-[1.75rem] border border-white/70 bg-[linear-gradient(150deg,rgba(255,255,255,0.94),rgba(255,244,234,0.9)),linear-gradient(180deg,#fff,#f6f0e8)] p-5 shadow-[0_20px_45px_rgba(41,51,64,0.08)] backdrop-blur-xl sm:p-6';
const cardClass = 'rounded-[1.75rem] border border-white/70 bg-white/80 p-5 shadow-[0_20px_45px_rgba(41,51,64,0.08)] backdrop-blur-xl sm:p-6';
const kickerClass = 'mb-2 text-xs font-bold uppercase tracking-[0.16em] text-[#ff6359]';
const heroTitleClass = 'm-0 font-["Avenir_Next_Condensed","Arial_Narrow",sans-serif] leading-[0.95] tracking-[-0.03em] text-[clamp(2rem,10vw,3.4rem)]';
const sectionTitleClass = 'm-0 font-["Avenir_Next_Condensed","Arial_Narrow",sans-serif] leading-none tracking-[-0.03em] text-[clamp(1.4rem,5vw,2rem)]';
const copyClass = 'm-0 text-sm leading-relaxed text-slate-500';
const softActionClass = 'inline-flex min-h-11 items-center justify-center rounded-full border border-slate-300/60 bg-white/75 px-4 py-2.5 text-sm font-bold text-slate-800 transition hover:-translate-y-0.5';
const errorClass = 'rounded-2xl bg-[#ffe4df] px-4 py-3 text-sm text-[#8f2d1f]';

export function SavedRecipesView({
  initialItems,
  snapshot,
}: {
  initialItems: SavedRecipeListItem[];
  snapshot: SavedRecipeSnapshot | null;
}) {
  const [items, setItems] = useState(initialItems);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(id: string) {
    setError(null);
    const response = await fetch(`/api/saved-recipes/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: 'Delete failed.' })) as { error?: string };
      setError(payload.error || 'Delete failed.');
      return;
    }
    setItems((current) => current.filter((item) => item.id !== id));
  }

  return (
    <main className={shellClass}>
      <section className={heroClass}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className={kickerClass}>Saved snapshots</p>
            <h1 className={heroTitleClass}>Saved Recipes</h1>
          </div>
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-gradient-to-br from-white/95 to-slate-100/90 text-sm font-extrabold tracking-[0.08em] text-slate-800 shadow-[0_12px_24px_rgba(43,52,61,0.1)]">SV</div>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-slate-500">Immutable recipe snapshots stored in Vercel Blob.</p>
        <div className="mt-4 flex flex-wrap gap-2.5">
          <Link className={softActionClass} href="/recipes">
            Back to Jeff the Cook
          </Link>
        </div>
      </section>

      {error ? <div className={`${errorClass} mt-4`}>{error}</div> : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <section className={cardClass}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className={sectionTitleClass}>Saved List</h2>
              <p className={copyClass}>{items.length} snapshot{items.length === 1 ? '' : 's'}</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3">
            {items.length === 0 ? (
              <div className="rounded-[1.5rem] border border-white/70 bg-white/80 p-4">
                <h3 className={sectionTitleClass}>No saved recipes</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">Save a generated recommendation from the main recipe workspace.</p>
              </div>
            ) : items.map((item) => (
              <article key={item.id} className="flex flex-col gap-3 rounded-[1.5rem] border border-slate-200/70 bg-white/75 p-4 sm:flex-row sm:justify-between">
                <div>
                  <h3 className="m-0 font-[Avenir_Next_Condensed,Arial_Narrow,sans-serif] text-[1.4rem] leading-none tracking-[-0.03em]">{item.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-500">{item.summary}</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-500">{new Date(item.savedAt).toLocaleString()}</p>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  <Link className={softActionClass} href={`/saved-recipes/${encodeURIComponent(item.id)}`}>
                    Open
                  </Link>
                  <button type="button" className={softActionClass} onClick={() => handleDelete(item.id)}>
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={cardClass}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className={sectionTitleClass}>Snapshot Detail</h2>
              <p className={copyClass}>
                {snapshot ? 'Selected saved recipe.' : 'Open a snapshot to inspect its frozen recipe state.'}
              </p>
            </div>
          </div>
          {snapshot ? (
            <div className="mt-4 grid gap-3">
              <section className="border-t border-slate-200/70 pt-3">
                <span className="mb-1 block text-[0.72rem] uppercase tracking-[0.1em] text-slate-500">Title</span>
                <p className={copyClass}>{snapshot.recommendation.title}</p>
              </section>
              <section className="border-t border-slate-200/70 pt-3">
                <span className="mb-1 block text-[0.72rem] uppercase tracking-[0.1em] text-slate-500">Summary</span>
                <p className={copyClass}>{snapshot.recommendation.summary}</p>
              </section>
              <section className="border-t border-slate-200/70 pt-3">
                <span className="mb-1 block text-[0.72rem] uppercase tracking-[0.1em] text-slate-500">Saved At</span>
                <p className={copyClass}>{new Date(snapshot.savedAt).toLocaleString()}</p>
              </section>
              <section className="border-t border-slate-200/70 pt-3">
                <span className="mb-1 block text-[0.72rem] uppercase tracking-[0.1em] text-slate-500">State</span>
                <p className={copyClass}>
                  Ingredients: {snapshot.recipeState.ingredients.join(', ') || 'none'}<br />
                  Notes: {snapshot.recipeState.notesRaw || 'none'}<br />
                  Mode: {snapshot.recipeState.mode}
                </p>
              </section>
              <section className="border-t border-slate-200/70 pt-3">
                <span className="mb-1 block text-[0.72rem] uppercase tracking-[0.1em] text-slate-500">Steps</span>
                <ol className="m-0 list-decimal pl-5 text-sm leading-relaxed text-slate-600">
                  {snapshot.recommendation.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </section>
            </div>
          ) : (
            <div className="mt-4 rounded-[1.5rem] border border-white/70 bg-white/80 p-4">
              <h3 className={sectionTitleClass}>Nothing selected</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">Choose an item from the saved list to inspect the immutable snapshot.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
