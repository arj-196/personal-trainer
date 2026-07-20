'use client';

import Link from 'next/link';
import { useState } from 'react';

import type { SavedRecipeSnapshot } from '@/lib/recipes/types';
import type { SavedRecipeListItem } from '@/lib/server/recipes-db';
import {
  Button,
  ButtonLink,
  Card,
  Chip,
  Display,
  EmptyState,
  ErrorBanner,
  Kicker,
} from '@/components/ui';

export function SavedRecipesView({
  initialItems,
  snapshot,
}: {
  initialItems: SavedRecipeListItem[];
  snapshot: SavedRecipeSnapshot | null;
}) {
  const [items, setItems] = useState(initialItems);
  const [error, setError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    setError(null);
    setConfirmingId(null);
    const response = await fetch(`/api/saved-recipes/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({ error: 'Delete failed.' }))) as {
        error?: string;
      };
      setError(payload.error || 'Delete failed.');
      return;
    }
    setItems((current) => current.filter((item) => item.id !== id));
  }

  if (snapshot) {
    return <SnapshotDetail snapshot={snapshot} />;
  }

  return (
    <div className="flex flex-col gap-3 px-[18px] pb-6 pt-4">
      <Display as="h1" className="text-[26px]">
        Saved Recipes
      </Display>

      {error ? <ErrorBanner>{error}</ErrorBanner> : null}

      {items.length === 0 ? (
        <EmptyState
          emoji="🍳"
          title="Nothing in the pantry"
          action={
            <ButtonLink variant="ink" size="sm" className="h-[42px] px-[18px] text-[13px]" href="/recipes">
              Ask Jeff →
            </ButtonLink>
          }
        >
          When Jeff cooks up something you like, hit Save — the recipe is frozen exactly as
          generated.
        </EmptyState>
      ) : null}

      {items.map((item) => (
        <Card key={item.id} className="flex flex-col gap-2 rounded-[18px] px-4 py-3.5">
          <Link
            href={`/saved-recipes/${encodeURIComponent(item.id)}`}
            className="flex flex-col gap-1"
          >
            <div className="flex items-baseline justify-between gap-2">
              <Display as="h2" className="text-[16px] font-bold">
                {item.title}
              </Display>
              <div className="whitespace-nowrap text-[11px] text-fnt">
                {new Date(item.savedAt).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </div>
            </div>
            <p className="m-0 text-[12.5px] leading-relaxed text-mut">{item.summary}</p>
          </Link>

          {confirmingId === item.id ? (
            <div className="flex items-center gap-2 rounded-[12px] border border-err-line bg-err-soft px-3 py-2">
              <div className="flex-1 text-[12px] font-semibold text-err">
                Delete forever? Snapshots don&apos;t come back.
              </div>
              <button
                type="button"
                onClick={() => void handleDelete(item.id)}
                className="cursor-pointer rounded-full border-none bg-err px-3 py-1.5 text-[11.5px] font-bold text-white"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmingId(null)}
                className="cursor-pointer rounded-full border border-ln2 bg-transparent px-2.5 py-1.5 text-[11.5px] font-bold text-ink"
              >
                Keep
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <ButtonLink
                variant="outline"
                size="sm"
                className="h-9 flex-1 border-none bg-bg2"
                href={`/saved-recipes/${encodeURIComponent(item.id)}`}
              >
                Open
              </ButtonLink>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 border-err-line px-3.5 text-err"
                onClick={() => setConfirmingId(item.id)}
              >
                Delete
              </Button>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

function SnapshotDetail({ snapshot }: { snapshot: SavedRecipeSnapshot }) {
  const { recommendation, recipeState } = snapshot;
  const mode = recipeState.mode.charAt(0).toUpperCase() + recipeState.mode.slice(1);

  return (
    <div className="flex flex-col gap-3 px-[18px] pb-6 pt-4">
      <div className="flex items-center gap-2.5">
        <Link
          href="/saved-recipes"
          aria-label="Back to saved recipes"
          className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-ln2 bg-card text-ink"
        >
          ←
        </Link>
        <Chip tone="vio" className="font-bold">
          ❄ Immutable snapshot
        </Chip>
      </div>

      <div className="flex flex-col gap-1">
        <Display as="h1" className="text-[24px]">
          {recommendation.title}
        </Display>
        <div className="text-[11.5px] text-fnt">
          Saved {new Date(snapshot.savedAt).toLocaleString()}
          {recommendation.totalMinutes ? ` · ${recommendation.totalMinutes} min` : ''}
        </div>
      </div>

      <p className="m-0 text-[13.5px] leading-relaxed text-mut">{recommendation.summary}</p>

      <Card className="flex flex-col gap-1.5 rounded-[18px] px-4 py-3.5">
        <Kicker>Ingredients</Kicker>
        {recommendation.ingredientLines.map((line) => (
          <div key={line} className="flex gap-2 text-[13px]">
            <span className="text-acc">·</span>
            {line}
          </div>
        ))}
      </Card>

      <Card className="flex flex-col gap-2 rounded-[18px] px-4 py-3.5">
        <Kicker>Steps</Kicker>
        {recommendation.steps.map((step, index) => (
          <div key={step} className="flex gap-2.5 text-[13px] leading-relaxed">
            <span className="flex-none font-display font-extrabold text-acc">{index + 1}</span>
            <span>{step}</span>
          </div>
        ))}
      </Card>

      <div className="flex flex-col gap-1.5 rounded-[18px] border border-vio bg-vio-soft px-4 py-3.5">
        <Kicker className="text-vio-deep">❄ The state that produced this</Kicker>
        <div className="text-[12.5px] leading-relaxed text-ink">
          <b>Ingredients:</b> {recipeState.ingredients.join(', ') || '—'}
        </div>
        <div className="text-[12.5px] leading-relaxed text-ink">
          <b>Notes:</b> {recipeState.notesRaw || '—'}
        </div>
        <div className="text-[12.5px] text-ink">
          <b>Mode:</b> {mode}
        </div>
      </div>
    </div>
  );
}
