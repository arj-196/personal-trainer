'use client';

import { useEffect, useMemo, useState } from 'react';

import {
  applyRecipeStatePatch,
  createEmptyRecipeState,
  ingredientTextFromList,
  parseIngredientText,
  recipeStatesEqual,
} from '@/lib/recipes/state';
import type {
  InterpretedUtterance,
  Recommendation,
  RecipeMode,
  RecipeState,
} from '@/lib/recipes/types';
import { audioFileExtensionForMimeType, normalizeAudioMimeType } from '@/lib/recipes/audio-format';
import { useMicrophoneRecorder } from '@/lib/recipes/use-microphone-recorder';
import {
  Button,
  Card,
  Chip,
  Display,
  ErrorBanner,
  Kicker,
  Skeleton,
  Spinner,
  cx,
  textareaClass,
} from '@/components/ui';

const MODE_OPTIONS: Array<{ value: RecipeMode; label: string }> = [
  { value: 'strict', label: 'Strict' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'anything', label: 'Anything' },
];

const MODE_HINTS: Record<RecipeMode, string> = {
  strict: 'Only your ingredients — pantry staples excepted.',
  hybrid: 'Mostly yours, a short shopping list allowed.',
  anything: 'Jeff cooks free. Your list is just inspiration.',
};

type MicStage = 'Listening… tell Jeff what you’ve got' | 'Transcribing…' | 'Interpreting…' | null;

export function RecipeWorkspace() {
  const [draft, setDraft] = useState<RecipeState>(createEmptyRecipeState());
  const [committed, setCommitted] = useState<RecipeState | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [micStage, setMicStage] = useState<MicStage>(null);
  const [heardExplanation, setHeardExplanation] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editField, setEditField] = useState<'ingredients' | 'notes' | null>(null);
  const [editValue, setEditValue] = useState('');

  const {
    error: micError,
    isRecording,
    startRecording,
    stopRecording,
  } = useMicrophoneRecorder({
    onRecordingComplete: handleCapturedAudio,
    onRecordingStart: () => setMicStage('Listening… tell Jeff what you’ve got'),
  });

  const hasPendingChanges = !recipeStatesEqual(draft, committed);
  const isBusy = isGenerating || isSaving || micStage !== null;
  const canGenerate = draft.ingredients.length > 0 && !isBusy;

  const syncChip = useMemo(() => {
    if (isGenerating) {
      return { label: '… Generating', className: 'border-gold bg-gold-soft text-gold-deep' };
    }
    if (recommendations.length === 0) {
      return { label: 'No recommendations yet', className: 'border-gold bg-gold-soft text-gold-deep' };
    }
    if (hasPendingChanges) {
      return { label: '● Pending changes', className: 'border-gold bg-gold-soft text-gold-deep' };
    }
    return { label: '✓ Synced', className: 'border-teal bg-teal-soft text-teal-deep' };
  }, [isGenerating, recommendations.length, hasPendingChanges]);

  useEffect(() => {
    if (micError) {
      setErrorMessage(micError);
      setMicStage(null);
    }
  }, [micError]);

  function beginEdit(field: 'ingredients' | 'notes') {
    setEditField(field);
    setEditValue(field === 'ingredients' ? ingredientTextFromList(draft.ingredients) : draft.notesRaw);
  }

  function commitEdit() {
    if (!editField) {
      return;
    }
    const patch =
      editField === 'ingredients'
        ? { ingredients: parseIngredientText(editValue) }
        : { notesRaw: editValue };
    setDraft((current) => applyRecipeStatePatch(current, patch));
    setEditField(null);
    setEditValue('');
  }

  async function handleGenerate() {
    if (!canGenerate) {
      return;
    }

    setIsGenerating(true);
    setErrorMessage(null);
    setHeardExplanation(null);

    try {
      const response = await fetch('/api/generate-recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipeState: draft }),
      });
      const payload = (await response.json()) as { recommendations?: Recommendation[]; error?: string };
      if (!response.ok || !payload.recommendations) {
        throw new Error(payload.error || 'Jeff burned that one. Try generating again.');
      }

      setRecommendations(payload.recommendations);
      setCommitted(draft);
      setExpandedId(null);
      setSavedIds([]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Jeff burned that one. Try generating again.');
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleCapturedAudio(audioBlob: Blob) {
    setMicStage('Transcribing…');
    try {
      const mimeType = normalizeAudioMimeType(audioBlob.type);
      const extension = audioFileExtensionForMimeType(mimeType);
      const audioFile = new File([audioBlob], `jeff-the-cook.${extension}`, { type: mimeType });
      const transcriptionForm = new FormData();
      transcriptionForm.set('audio', audioFile);
      const transcriptionResponse = await fetch('/api/transcribe', {
        method: 'POST',
        body: transcriptionForm,
      });
      const transcriptionPayload = (await transcriptionResponse.json()) as {
        transcript?: string;
        error?: string;
      };
      if (!transcriptionResponse.ok || !transcriptionPayload.transcript) {
        throw new Error(transcriptionPayload.error || 'Transcription failed.');
      }

      setMicStage('Interpreting…');
      const interpretResponse = await fetch('/api/interpret-utterance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: transcriptionPayload.transcript, draft }),
      });
      const interpretPayload = (await interpretResponse.json()) as {
        result?: InterpretedUtterance;
        error?: string;
      };
      if (!interpretResponse.ok || !interpretPayload.result) {
        throw new Error(interpretPayload.error || 'Interpretation failed.');
      }

      setDraft(interpretPayload.result.updatedDraft);
      setHeardExplanation(
        interpretPayload.result.explanation ||
          `Updated the draft from “${transcriptionPayload.transcript}”.`,
      );
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Voice update failed.');
    } finally {
      setMicStage(null);
    }
  }

  async function handleSave(recommendation: Recommendation) {
    if (!committed || savedIds.includes(recommendation.id)) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    try {
      const response = await fetch('/api/save-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipeState: committed, recommendation }),
      });
      const payload = (await response.json()) as { snapshot?: { id: string }; error?: string };
      if (!response.ok || !payload.snapshot) {
        throw new Error(payload.error || 'Save failed.');
      }
      setSavedIds((current) => [...current, recommendation.id]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Save failed.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 px-[18px] pb-[120px] pt-4">
      <div className="flex items-center justify-between">
        <Display as="h1" className="text-[26px]">
          Jeff the Cook
        </Display>
        <span
          className={cx(
            'whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold',
            syncChip.className,
          )}
        >
          {syncChip.label}
        </span>
      </div>

      {micStage ? (
        <div className="flex items-center gap-2.5 rounded-[16px] border border-gold bg-card px-3.5 py-3">
          <Spinner tone="gold" className="h-4 w-4" />
          <div className="animate-pulse-soft text-[13px] font-semibold text-gold-deep">{micStage}</div>
        </div>
      ) : null}

      {heardExplanation ? (
        <div className="flex items-start gap-2.5 rounded-[16px] border border-teal bg-teal-soft px-3.5 py-3">
          <div className="text-[14px]">👂</div>
          <div className="flex-1 text-[12.5px] leading-relaxed text-teal-deep">
            <b>Jeff heard you.</b> {heardExplanation}
          </div>
          <button
            type="button"
            onClick={() => setHeardExplanation(null)}
            aria-label="Dismiss"
            className="cursor-pointer border-none bg-transparent p-0 text-[13px] text-teal-deep"
          >
            ✕
          </button>
        </div>
      ) : null}

      {errorMessage ? <ErrorBanner>{errorMessage}</ErrorBanner> : null}

      {/* draft */}
      <Card className="flex flex-col gap-2.5 px-4 py-3.5">
        <div className="flex items-center justify-between">
          <Kicker>Ingredients</Kicker>
          <button
            type="button"
            onClick={editField === 'ingredients' ? commitEdit : () => beginEdit('ingredients')}
            className="flex cursor-pointer items-center gap-1 rounded-full border-none bg-acc-soft px-3 py-1.5 text-[12px] font-bold text-acc-deep"
          >
            ✎ {editField === 'ingredients' ? 'Done' : 'Edit'}
          </button>
        </div>
        {editField === 'ingredients' ? (
          <textarea
            className={textareaClass}
            rows={5}
            value={editValue}
            onChange={(event) => setEditValue(event.target.value)}
            placeholder="one ingredient per line"
            autoFocus
          />
        ) : draft.ingredients.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {draft.ingredients.map((ingredient) => (
              <span
                key={ingredient}
                className="rounded-full bg-bg2 px-3 py-1.5 text-[12.5px] font-semibold text-ink"
              >
                {ingredient}
              </span>
            ))}
          </div>
        ) : (
          <div className="text-[13px] text-fnt">
            Nothing yet. Hit Edit — or just tell Jeff what you&apos;ve got.
          </div>
        )}

        <div className="flex flex-col gap-2 border-t border-dashed border-ln pt-2.5">
          <div className="flex items-center justify-between">
            <Kicker>Notes for Jeff</Kicker>
            <button
              type="button"
              onClick={editField === 'notes' ? commitEdit : () => beginEdit('notes')}
              className="cursor-pointer border-none bg-transparent px-1.5 py-0.5 text-[12px] font-bold text-acc"
            >
              ✎ {editField === 'notes' ? 'Done' : 'Edit'}
            </button>
          </div>
          {editField === 'notes' ? (
            <textarea
              className={textareaClass}
              rows={2}
              value={editValue}
              onChange={(event) => setEditValue(event.target.value)}
              placeholder="constraints, cravings, time budget…"
              autoFocus
            />
          ) : (
            <div className="text-[13px] leading-relaxed text-mut">
              {draft.notesRaw || 'No constraints. Jeff cooks free.'}
            </div>
          )}
        </div>
      </Card>

      {/* mode */}
      <div className="flex rounded-full border border-ln bg-card p-1">
        {MODE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setDraft((current) => applyRecipeStatePatch(current, { mode: option.value }))}
            className={cx(
              'h-[38px] flex-1 cursor-pointer rounded-full border-none text-[13px] font-semibold',
              draft.mode === option.value ? 'bg-ink text-onink' : 'bg-transparent text-mut',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="-mt-1 text-center text-[11px] text-fnt">{MODE_HINTS[draft.mode]}</div>

      <Button
        type="button"
        size="lg"
        onClick={handleGenerate}
        disabled={!canGenerate}
      >
        Generate 3 recipes →
      </Button>

      {/* recommendations */}
      {isGenerating ? (
        <div className="flex flex-col gap-2.5">
          <div className="animate-pulse-soft text-center text-[12px] text-fnt">
            Jeff is thinking with his hands…
          </div>
          <Skeleton className="h-[92px]" />
          <Skeleton className="h-[92px]" />
          <Skeleton className="h-[92px]" />
        </div>
      ) : null}

      {!isGenerating &&
        recommendations.map((recommendation) => {
          const isExpanded = expandedId === recommendation.id;
          const isSaved = savedIds.includes(recommendation.id);
          return (
            <Card key={recommendation.id} className="overflow-hidden">
              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : recommendation.id)}
                className="flex w-full cursor-pointer flex-col gap-1.5 border-none bg-transparent px-4 py-3.5 text-left"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <Display as="h3" className="text-[16.5px] font-bold leading-tight">
                    {recommendation.title}
                  </Display>
                  <div className="whitespace-nowrap text-[12px] font-bold text-acc">
                    {recommendation.totalMinutes ? `${recommendation.totalMinutes} min` : 'flexible'}
                  </div>
                </div>
                <p className="m-0 text-[13px] leading-relaxed text-mut">{recommendation.summary}</p>
                <div className="flex flex-wrap gap-1.5">
                  <Chip tone="teal" className="text-[10px]">
                    used {recommendation.availableIngredientsUsed.length}
                  </Chip>
                  <Chip className="text-[10px]">
                    unused {recommendation.availableIngredientsUnused.length}
                  </Chip>
                  <Chip tone="gold" className="text-[10px]">
                    need {recommendation.extraIngredients.length}
                  </Chip>
                </div>
              </button>
              {isExpanded ? (
                <div className="flex flex-col gap-3 border-t border-dashed border-ln px-4 pb-4">
                  <p className="m-0 pt-3 text-[12.5px] leading-relaxed text-mut">
                    <b className="text-ink">Why this:</b> {recommendation.rationale}
                  </p>
                  <div className="flex flex-col gap-1">
                    <Kicker>Ingredients</Kicker>
                    {recommendation.ingredientLines.map((line) => (
                      <div key={line} className="flex gap-2 text-[13px] text-ink">
                        <span className="text-acc">·</span>
                        {line}
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <ChipGroup
                      label="You have, used:"
                      items={recommendation.availableIngredientsUsed}
                      tone="teal"
                    />
                    {recommendation.availableIngredientsUnused.length > 0 ? (
                      <ChipGroup
                        label="You have, unused:"
                        items={recommendation.availableIngredientsUnused}
                        tone="neutral"
                      />
                    ) : null}
                    {recommendation.extraIngredients.length > 0 ? (
                      <ChipGroup
                        label="Need to get:"
                        items={recommendation.extraIngredients}
                        tone="gold"
                      />
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Kicker>Steps</Kicker>
                    {recommendation.steps.map((step, index) => (
                      <div key={step} className="flex gap-2.5 text-[13px] leading-relaxed">
                        <span className="flex-none font-display font-extrabold text-acc">
                          {index + 1}
                        </span>
                        <span className="text-ink">{step}</span>
                      </div>
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant={isSaved ? 'soft' : 'accent'}
                    className={cx('h-11 text-[13.5px]', isSaved && 'bg-teal-soft text-teal-deep')}
                    onClick={() => handleSave(recommendation)}
                    disabled={isSaving || isSaved}
                  >
                    {isSaved ? '✓ Saved to snapshots' : 'Save this recipe'}
                  </Button>
                </div>
              ) : null}
            </Card>
          );
        })}

      {/* mic */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(96px+env(safe-area-inset-bottom))] z-30 flex flex-col items-center gap-1">
        <button
          type="button"
          onClick={isRecording ? stopRecording : () => void startRecording()}
          disabled={isBusy && !isRecording}
          aria-label={isRecording ? 'Stop listening' : 'Tell Jeff what you have'}
          className={cx(
            'pointer-events-auto flex h-[66px] w-[66px] cursor-pointer items-center justify-center rounded-full border-none text-white shadow-[0_10px_26px_rgba(255,106,61,0.45)] disabled:opacity-60',
            isRecording ? 'animate-mic-pulse bg-gold' : 'bg-acc',
          )}
        >
          <MicIcon />
        </button>
        <div className="pointer-events-none rounded-[6px] bg-bg px-2 py-px text-[11px] font-semibold text-mut">
          {isRecording || micStage ? 'Jeff is listening…' : 'Tell Jeff what you’ve got'}
        </div>
      </div>
    </div>
  );
}

function ChipGroup({
  label,
  items,
  tone,
}: {
  label: string;
  items: string[];
  tone: 'teal' | 'gold' | 'neutral';
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] font-bold uppercase text-fnt">{label}</span>
      {items.map((item) => (
        <Chip key={item} tone={tone}>
          {item}
        </Chip>
      ))}
    </div>
  );
}

function MicIcon() {
  return (
    <svg className="h-7 w-7" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M12 3.5a3.5 3.5 0 0 0-3.5 3.5v5a3.5 3.5 0 1 0 7 0V7A3.5 3.5 0 0 0 12 3.5Z"
        fill="currentColor"
      />
      <path
        d="M6 11.5a1 1 0 1 1 2 0 4 4 0 1 0 8 0 1 1 0 1 1 2 0 6 6 0 0 1-5 5.91V20h2a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2h2v-2.59a6 6 0 0 1-5-5.91Z"
        fill="currentColor"
      />
    </svg>
  );
}
