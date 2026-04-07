'use client';

import Link from 'next/link';
import { useState } from 'react';

import type { SavedRecipeListItem } from '@/lib/recipes/blob-store';
import type { SavedRecipeSnapshot } from '@/lib/recipes/types';

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
    <main className="shell">
      <section className="hero-panel hero-panel-compact">
        <div className="hero-topline">
          <div>
            <p className="section-kicker">Saved snapshots</p>
            <h1 className="hero-title recipe-hero-title">Saved Recipes</h1>
          </div>
          <div className="hero-avatar" aria-hidden="true">SV</div>
        </div>
        <p className="hero-subtitle">Immutable recipe snapshots stored in Vercel Blob.</p>
        <div className="hero-actions">
          <Link className="soft-action" href="/recipes">
            Back to Jeff the Cook
          </Link>
        </div>
      </section>

      {error ? <div className="recipe-feedback is-error">{error}</div> : null}

      <div className="saved-layout">
        <section className="panel-card">
          <div className="section-head">
            <div>
              <h2 className="section-title">Saved List</h2>
              <p className="section-copy">{items.length} snapshot{items.length === 1 ? '' : 's'}</p>
            </div>
          </div>
          <div className="saved-list">
            {items.length === 0 ? (
              <div className="empty-state">
                <h3 className="section-title">No saved recipes</h3>
                <p>Save a generated recommendation from the main recipe workspace.</p>
              </div>
            ) : items.map((item) => (
              <article key={item.id} className="saved-item-card">
                <div>
                  <h3 className="library-title">{item.title}</h3>
                  <p className="library-copy">{item.summary}</p>
                  <p className="section-copy">{new Date(item.savedAt).toLocaleString()}</p>
                </div>
                <div className="hero-actions">
                  <Link className="soft-action" href={`/saved-recipes/${encodeURIComponent(item.id)}`}>
                    Open
                  </Link>
                  <button type="button" className="soft-action" onClick={() => handleDelete(item.id)}>
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="panel-card">
          <div className="section-head">
            <div>
              <h2 className="section-title">Snapshot Detail</h2>
              <p className="section-copy">
                {snapshot ? 'Selected saved recipe.' : 'Open a snapshot to inspect its frozen recipe state.'}
              </p>
            </div>
          </div>
          {snapshot ? (
            <div className="detail-list">
              <section className="detail-section">
                <span className="detail-label">Title</span>
                <p className="library-copy">{snapshot.recommendation.title}</p>
              </section>
              <section className="detail-section">
                <span className="detail-label">Summary</span>
                <p className="library-copy">{snapshot.recommendation.summary}</p>
              </section>
              <section className="detail-section">
                <span className="detail-label">Saved At</span>
                <p className="library-copy">{new Date(snapshot.savedAt).toLocaleString()}</p>
              </section>
              <section className="detail-section">
                <span className="detail-label">State</span>
                <p className="library-copy">
                  Ingredients: {snapshot.recipeState.ingredients.join(', ') || 'none'}<br />
                  Notes: {snapshot.recipeState.notesRaw || 'none'}<br />
                  Mode: {snapshot.recipeState.mode}
                </p>
              </section>
              <section className="detail-section">
                <span className="detail-label">Steps</span>
                <ol className="recipe-steps">
                  {snapshot.recommendation.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </section>
            </div>
          ) : (
            <div className="empty-state">
              <h3 className="section-title">Nothing selected</h3>
              <p>Choose an item from the saved list to inspect the immutable snapshot.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
