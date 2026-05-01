'use client';

import Link from 'next/link';
import { createPortal } from 'react-dom';
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

const MODE_OPTIONS: Array<{ value: RecipeMode; label: string }> = [
  { value: 'strict', label: 'Strict' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'anything', label: 'Anything' },
];

type WorkspaceStatus =
  | 'Ready to generate'
  | 'Listening...'
  | 'Transcribing...'
  | 'Interpreting...'
  | 'Generating...'
  | 'Saving...'
  | 'Saved';

export function RecipeWorkspace() {
  const [draft, setDraft] = useState<RecipeState>(createEmptyRecipeState());
  const [committed, setCommitted] = useState<RecipeState | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [status, setStatus] = useState<WorkspaceStatus>('Ready to generate');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [editField, setEditField] = useState<'ingredients' | 'notes' | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [deletingSaved, setDeletingSaved] = useState<string | null>(null);
  const {
    error: micError,
    isRecording,
    startRecording,
    stopRecording,
  } = useMicrophoneRecorder({
    onRecordingComplete: handleCapturedAudio,
    onRecordingStart: () => setStatus('Listening...'),
  });

  const hasPendingChanges = !recipeStatesEqual(draft, committed);
  const canGenerate = draft.ingredients.length > 0 && !isBusy;

  const currentUtteranceSummary = useMemo(
    () => `${draft.ingredients.length} ingredients, ${draft.mode} mode`,
    [draft.ingredients.length, draft.mode]
  );

  useEffect(() => {
    if (micError) {
      setFeedback(micError);
      setStatus('Ready to generate');
    }
  }, [micError]);

  useEffect(() => {
    setIsClient(true);
  }, []);

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
    setFeedback(null);
  }

  async function handleGenerate() {
    if (!canGenerate) {
      return;
    }

    setIsBusy(true);
    setStatus('Generating...');
    setFeedback(null);

    try {
      const response = await fetch('/api/generate-recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipeState: draft }),
      });
      const payload = await response.json() as { recommendations?: Recommendation[]; error?: string };
      if (!response.ok || !payload.recommendations) {
        throw new Error(payload.error || 'Generation failed.');
      }

      setRecommendations(payload.recommendations);
      setCommitted(draft);
      setExpandedId(null);
      setStatus('Ready to generate');
    } catch (error) {
      setStatus('Ready to generate');
      setFeedback(error instanceof Error ? error.message : 'Generation failed.');
    } finally {
      setIsBusy(false);
    }
  }

  async function startListening() {
    setFeedback(null);
    await startRecording();
  }

  function stopListening() {
    stopRecording();
  }

  async function handleCapturedAudio(audioBlob: Blob) {
    setIsBusy(true);
    setStatus('Transcribing...');
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
      const transcriptionPayload = await transcriptionResponse.json() as { transcript?: string; error?: string };
      if (!transcriptionResponse.ok || !transcriptionPayload.transcript) {
        throw new Error(transcriptionPayload.error || 'Transcription failed.');
      }
      console.log('Transcription result:', transcriptionPayload.transcript);

      setStatus('Interpreting...');
      const interpretResponse = await fetch('/api/interpret-utterance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: transcriptionPayload.transcript, draft }),
      });
      const interpretPayload = await interpretResponse.json() as { result?: InterpretedUtterance; error?: string };
      if (!interpretResponse.ok || !interpretPayload.result) {
        throw new Error(interpretPayload.error || 'Interpretation failed.');
      }

      setDraft(interpretPayload.result.updatedDraft);
      setFeedback(interpretPayload.result.explanation || `Updated draft from "${transcriptionPayload.transcript}".`);
      setStatus('Ready to generate');
    } catch (error) {
      setStatus('Ready to generate');
      setFeedback(error instanceof Error ? error.message : 'Voice update failed.');
    } finally {
      setIsBusy(false);
    }
  }

  async function handleSave(recommendation: Recommendation) {
    if (!committed) {
      return;
    }

    setIsBusy(true);
    setStatus('Saving...');
    setFeedback(null);
    try {
      const response = await fetch('/api/save-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipeState: committed, recommendation }),
      });
      const payload = await response.json() as { snapshot?: { id: string }; error?: string };
      if (!response.ok || !payload.snapshot) {
        throw new Error(payload.error || 'Save failed.');
      }
      setStatus('Saved');
      setFeedback(`Saved "${recommendation.title}".`);
      window.setTimeout(() => setStatus('Ready to generate'), 1200);
    } catch (error) {
      setStatus('Ready to generate');
      setFeedback(error instanceof Error ? error.message : 'Save failed.');
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-[calc(68px+22px+24px+env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:pt-5">
      <section className="rounded-[1.75rem] border border-white/70 bg-[linear-gradient(150deg,rgba(255,255,255,0.94),rgba(255,244,234,0.9)),linear-gradient(180deg,#fff,#f6f0e8)] p-5 shadow-[0_20px_45px_rgba(41,51,64,0.08)] backdrop-blur-xl sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-[#ff6359]">Recipe workspace</p>
            <h1 className="m-0 font-[Avenir_Next_Condensed,Arial_Narrow,sans-serif] text-[clamp(2rem,10vw,3.4rem)] leading-[0.95] tracking-[-0.03em]">Jeff the Cook!</h1>
          </div>
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-gradient-to-br from-white/95 to-slate-100/90 text-sm font-extrabold tracking-[0.08em] text-slate-800 shadow-[0_12px_24px_rgba(43,52,61,0.1)]" aria-hidden="true">JC</div>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-slate-500">
          Voice-first recipe generation with a draft workspace you can review before you commit.
        </p>
        <div className="mt-4 flex flex-wrap gap-2.5">
          <Link className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-300/60 bg-white/75 px-4 py-2.5 text-sm font-bold text-slate-800 transition hover:-translate-y-0.5" href="/">
            Workout View
          </Link>
          <Link className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-300/60 bg-white/75 px-4 py-2.5 text-sm font-bold text-slate-800 transition hover:-translate-y-0.5" href="/saved-recipes">
            Saved Recipes
          </Link>
        </div>
      </section>

      <section className="relative mt-4 overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/80 p-5 pb-[88px] shadow-[0_20px_45px_rgba(41,51,64,0.08)] backdrop-blur-xl sm:p-6 sm:pb-[88px]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="m-0 font-[Avenir_Next_Condensed,Arial_Narrow,sans-serif] text-[clamp(1.45rem,5.5vw,2.1rem)] leading-none tracking-[-0.03em]">Main View</h2>
            <p className="m-0 text-sm leading-relaxed text-slate-500">Status: <strong>{status}</strong></p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-full bg-[#ff6359]/12 px-3 py-1.5 text-xs font-bold text-[#b54843]">{currentUtteranceSummary}</span>
            <span className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-bold ${hasPendingChanges ? 'bg-[#ffe7df] text-[#8f2d1f]' : 'bg-[#ff6359]/12 text-[#b54843]'}`}>
              {hasPendingChanges ? 'Pending changes' : 'Recommendations synced'}
            </span>
          </div>
        </div>

        <div className="mt-4 grid gap-4">
          <section className="rounded-[1.5rem] border border-slate-200/70 bg-white/75 p-4">
            <div className="grid gap-4">
              <EditableField
                label="Ingredients"
                editing={editField === 'ingredients'}
                displayValue={draft.ingredients.length > 0 ? ingredientTextFromList(draft.ingredients) : 'Double-click and add what you have.'}
                editValue={editValue}
                onBeginEdit={() => beginEdit('ingredients')}
                onChange={setEditValue}
                onCommit={commitEdit}
                placeholder="potatoes, onions, garlic, chicken"
              />
              <EditableField
                label="Notes"
                editing={editField === 'notes'}
                displayValue={draft.notesRaw || 'Double-click and add preferences or constraints.'}
                editValue={editValue}
                onBeginEdit={() => beginEdit('notes')}
                onChange={setEditValue}
                onCommit={commitEdit}
                placeholder="air fried, high protein, spicy, under 20 minutes"
              />
              <section className="border-t border-slate-200/70 pt-3">
                <span className="mb-1 block text-[0.72rem] uppercase tracking-[0.1em] text-slate-500">Mode</span>
                <div className="flex flex-wrap gap-2.5">
                  {MODE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`rounded-full border px-4 py-2.5 text-sm font-bold ${draft.mode === option.value ? 'border-transparent bg-[#ff6359] text-white' : 'border-slate-300/60 bg-white/85 text-slate-600'}`}
                      onClick={() => setDraft((current) => applyRecipeStatePatch(current, { mode: option.value }))}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </section>
            </div>
          </section>

          <div className="flex flex-col items-stretch justify-between gap-3 px-1 sm:flex-row sm:items-center">
            <button className="inline-flex min-h-11 items-center justify-center rounded-full border border-transparent bg-gradient-to-br from-[#ff6a60] to-[#ff7f5d] px-4 py-2.5 text-sm font-bold text-white shadow-[0_12px_24px_rgba(255,99,89,0.24)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60" type="button" onClick={handleGenerate} disabled={!canGenerate}>
              Generate Recipes
            </button>
            <p className="m-0 text-sm leading-relaxed text-slate-500">
              Recommendations only update when you confirm the current draft.
            </p>
          </div>

          {feedback ? (
            <div className={`rounded-2xl px-4 py-3 text-sm ${feedback.toLowerCase().includes('failed') ? 'bg-[#ffe4df] text-[#8f2d1f]' : 'bg-cyan-100/70 text-slate-900'}`}>
              {feedback}
            </div>
          ) : null}

          <section className="rounded-[1.5rem] border border-slate-200/70 bg-white/75 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="m-0 font-[Avenir_Next_Condensed,Arial_Narrow,sans-serif] text-[clamp(1.45rem,5.5vw,2.1rem)] leading-none tracking-[-0.03em]">Recommendations</h2>
                <p className="m-0 text-sm leading-relaxed text-slate-500">
                  {recommendations.length === 0 ? 'Generate to see three recipe options.' : 'Tap a card to expand details.'}
                </p>
              </div>
            </div>
            {recommendations.length === 0 ? (
              <div className="mt-4 rounded-[1.5rem] border border-white/70 bg-white/80 p-4">
                <h3 className="m-0 font-[Avenir_Next_Condensed,Arial_Narrow,sans-serif] text-[clamp(1.3rem,5vw,1.7rem)] leading-[1.05] tracking-[-0.03em]">Nothing generated yet</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">Speak ingredients and constraints, review the draft, then generate.</p>
              </div>
            ) : (
              <div className="mt-4 grid gap-4">
                {recommendations.map((recommendation) => {
                  const expanded = expandedId === recommendation.id;
                  return (
                    <article key={recommendation.id} className={`rounded-[1.5rem] border border-slate-200/70 bg-white/80 p-4 ${expanded ? 'shadow-[0_20px_45px_rgba(41,51,64,0.08)]' : ''}`}>
                      <button
                        type="button"
                        className="flex w-full flex-col items-start justify-between gap-3 border-0 bg-transparent p-0 text-left sm:flex-row"
                        onClick={() => setExpandedId(expanded ? null : recommendation.id)}
                      >
                        <div>
                          <h3 className="m-0 font-[Avenir_Next_Condensed,Arial_Narrow,sans-serif] text-[1.4rem] leading-none tracking-[-0.03em]">{recommendation.title}</h3>
                          <p className="m-0 text-sm leading-relaxed text-slate-500">{recommendation.summary}</p>
                        </div>
                        <span className="inline-flex items-center rounded-full bg-[#ff6359]/12 px-3 py-1.5 text-xs font-bold text-[#b54843]">{recommendation.totalMinutes ? `${recommendation.totalMinutes} min` : 'Flexible'}</span>
                      </button>

                      {expanded ? (
                        <div className="mt-3 grid gap-3">
                          <section className="border-t border-slate-200/70 pt-3">
                            <span className="mb-1 block text-[0.72rem] uppercase tracking-[0.1em] text-slate-500">Rationale</span>
                            <p className="m-0 text-sm leading-relaxed text-slate-500">{recommendation.rationale}</p>
                          </section>
                          <section className="border-t border-slate-200/70 pt-3">
                            <span className="mb-1 block text-[0.72rem] uppercase tracking-[0.1em] text-slate-500">Available Ingredients Used</span>
                            <div className="flex flex-wrap gap-2">
                              {recommendation.availableIngredientsUsed.map((item) => (
                                <span key={item} className="inline-flex items-center rounded-full bg-[#ff6359]/12 px-3 py-1.5 text-xs font-bold text-[#b54843]">{item}</span>
                              ))}
                            </div>
                          </section>
                          <section className="border-t border-slate-200/70 pt-3">
                            <span className="mb-1 block text-[0.72rem] uppercase tracking-[0.1em] text-slate-500">Available Ingredients Unused</span>
                            <div className="flex flex-wrap gap-2">
                              {recommendation.availableIngredientsUnused.length > 0 ? recommendation.availableIngredientsUnused.map((item) => (
                                <span key={item} className="inline-flex items-center rounded-full bg-cyan-100/70 px-3 py-1.5 text-xs font-bold text-cyan-800">{item}</span>
                              )) : <span className="inline-flex items-center rounded-full bg-[#ff6359]/12 px-3 py-1.5 text-xs font-bold text-[#b54843]">none</span>}
                            </div>
                          </section>
                          <section className="border-t border-slate-200/70 pt-3">
                            <span className="mb-1 block text-[0.72rem] uppercase tracking-[0.1em] text-slate-500">Extra Ingredients Needed</span>
                            <div className="flex flex-wrap gap-2">
                              {recommendation.extraIngredients.length > 0 ? recommendation.extraIngredients.map((item) => (
                                <span key={item} className="inline-flex items-center rounded-full bg-cyan-100/70 px-3 py-1.5 text-xs font-bold text-cyan-800">{item}</span>
                              )) : <span className="inline-flex items-center rounded-full bg-[#ff6359]/12 px-3 py-1.5 text-xs font-bold text-[#b54843]">none</span>}
                            </div>
                          </section>
                          <section className="border-t border-slate-200/70 pt-3">
                            <span className="mb-1 block text-[0.72rem] uppercase tracking-[0.1em] text-slate-500">Preparation Steps</span>
                            <ol className="m-0 list-decimal pl-5 text-sm leading-relaxed text-slate-600">
                              {recommendation.steps.map((step) => (
                                <li key={step}>{step}</li>
                              ))}
                            </ol>
                          </section>
                          <div className="flex flex-wrap gap-2.5">
                            <button className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-300/60 bg-white/75 px-4 py-2.5 text-sm font-bold text-slate-800 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60" type="button" onClick={() => handleSave(recommendation)} disabled={isBusy}>
                              Save
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>

      </section>

      {isClient ? createPortal(
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(22px+env(safe-area-inset-bottom))] z-[2147483647] flex justify-center sm:bottom-[calc(18px+env(safe-area-inset-bottom))]">
          <button
            type="button"
            className={`pointer-events-auto grid h-[68px] w-[68px] place-items-center rounded-full border-0 text-white shadow-[0_22px_60px_rgba(20,24,30,0.16)] ${isRecording ? 'bg-[#c8362f]' : 'bg-[#17181c]'}`}
            onClick={isRecording ? stopListening : startListening}
            disabled={isBusy && !isRecording}
            aria-label={isRecording ? 'Stop listening' : 'Start listening'}
          >
            <MicIcon />
          </button>
        </div>,
        document.body
      ) : null}
    </main>
  );
}

function MicIcon() {
  return (
    <svg
      className="h-7 w-7"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
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

function EditableField({
  label,
  editing,
  displayValue,
  editValue,
  onBeginEdit,
  onChange,
  onCommit,
  placeholder,
}: {
  label: string;
  editing: boolean;
  displayValue: string;
  editValue: string;
  onBeginEdit: () => void;
  onChange: (value: string) => void;
  onCommit: () => void;
  placeholder: string;
}) {
  return (
    <section className="border-t border-slate-200/70 pt-3">
      <span className="mb-1 block text-[0.72rem] uppercase tracking-[0.1em] text-slate-500">{label}</span>
      {editing ? (
        <textarea
          className="min-h-[92px] w-full resize-y rounded-[18px] border border-slate-300/60 bg-white/85 px-3.5 py-3 text-slate-900"
          value={editValue}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onCommit}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
              onCommit();
            }
          }}
          autoFocus
          placeholder={placeholder}
        />
      ) : (
        <button type="button" className="w-full border-0 bg-transparent p-0 text-left leading-relaxed text-slate-900" onDoubleClick={onBeginEdit}>
          {displayValue}
        </button>
      )}
    </section>
  );
}
