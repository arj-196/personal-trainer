'use client';

import Link from 'next/link';
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
      const audioFile = new File([audioBlob], 'jeff-the-cook.webm', { type: audioBlob.type || 'audio/webm' });
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
    <main className="shell">
      <section className="hero-panel hero-panel-compact">
        <div className="hero-topline">
          <div>
            <p className="section-kicker">Recipe workspace</p>
            <h1 className="hero-title recipe-hero-title">Jeff the Cook!</h1>
          </div>
          <div className="hero-avatar" aria-hidden="true">JC</div>
        </div>
        <p className="hero-subtitle">
          Voice-first recipe generation with a draft workspace you can review before you commit.
        </p>
        <div className="hero-actions">
          <Link className="soft-action" href="/">
            Workout View
          </Link>
          <Link className="soft-action" href="/saved-recipes">
            Saved Recipes
          </Link>
        </div>
      </section>

      <section className="panel-card recipe-workspace-card">
        <div className="section-head">
          <div>
            <h2 className="section-title">Main View</h2>
            <p className="section-copy">Status: <strong>{status}</strong></p>
          </div>
          <div className="badge-row">
            <span className="badge">{currentUtteranceSummary}</span>
            <span className={`badge ${hasPendingChanges ? 'badge-attention' : ''}`}>
              {hasPendingChanges ? 'Pending changes' : 'Recommendations synced'}
            </span>
          </div>
        </div>

        <div className="recipe-panel-grid">
          <section className="recipe-state-panel">
            <div className="recipe-state-grid">
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
              <section className="detail-section">
                <span className="detail-label">Mode</span>
                <div className="mode-pill-row">
                  {MODE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`mode-pill ${draft.mode === option.value ? 'active' : ''}`}
                      onClick={() => setDraft((current) => applyRecipeStatePatch(current, { mode: option.value }))}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </section>
            </div>
          </section>

          <div className="recipe-generate-row">
            <button className="primary-action chip-button" type="button" onClick={handleGenerate} disabled={!canGenerate}>
              Generate Recipes
            </button>
            <p className="section-copy">
              Recommendations only update when you confirm the current draft.
            </p>
          </div>

          {feedback ? (
            <div className={`recipe-feedback ${feedback.toLowerCase().includes('failed') ? 'is-error' : ''}`}>
              {feedback}
            </div>
          ) : null}

          <section className="recipe-results-panel">
            <div className="section-head">
              <div>
                <h2 className="section-title">Recommendations</h2>
                <p className="section-copy">
                  {recommendations.length === 0 ? 'Generate to see three recipe options.' : 'Tap a card to expand details.'}
                </p>
              </div>
            </div>
            {recommendations.length === 0 ? (
              <div className="empty-state recipe-empty-state">
                <h3 className="section-title">Nothing generated yet</h3>
                <p>Speak ingredients and constraints, review the draft, then generate.</p>
              </div>
            ) : (
              <div className="recipe-recommendation-stack">
                {recommendations.map((recommendation) => {
                  const expanded = expandedId === recommendation.id;
                  return (
                    <article key={recommendation.id} className={`recipe-option-card ${expanded ? 'expanded' : ''}`}>
                      <button
                        type="button"
                        className="recipe-option-trigger"
                        onClick={() => setExpandedId(expanded ? null : recommendation.id)}
                      >
                        <div>
                          <h3 className="library-title">{recommendation.title}</h3>
                          <p className="library-copy">{recommendation.summary}</p>
                        </div>
                        <span className="badge">{recommendation.totalMinutes ? `${recommendation.totalMinutes} min` : 'Flexible'}</span>
                      </button>

                      {expanded ? (
                        <div className="detail-list">
                          <section className="detail-section">
                            <span className="detail-label">Rationale</span>
                            <p className="library-copy">{recommendation.rationale}</p>
                          </section>
                          <section className="detail-section">
                            <span className="detail-label">Available Ingredients Used</span>
                            <div className="badge-row">
                              {recommendation.availableIngredientsUsed.map((item) => (
                                <span key={item} className="badge">{item}</span>
                              ))}
                            </div>
                          </section>
                          <section className="detail-section">
                            <span className="detail-label">Available Ingredients Unused</span>
                            <div className="badge-row">
                              {recommendation.availableIngredientsUnused.length > 0 ? recommendation.availableIngredientsUnused.map((item) => (
                                <span key={item} className="badge badge-muted">{item}</span>
                              )) : <span className="badge">none</span>}
                            </div>
                          </section>
                          <section className="detail-section">
                            <span className="detail-label">Extra Ingredients Needed</span>
                            <div className="badge-row">
                              {recommendation.extraIngredients.length > 0 ? recommendation.extraIngredients.map((item) => (
                                <span key={item} className="badge badge-muted">{item}</span>
                              )) : <span className="badge">none</span>}
                            </div>
                          </section>
                          <section className="detail-section">
                            <span className="detail-label">Preparation Steps</span>
                            <ol className="recipe-steps">
                              {recommendation.steps.map((step) => (
                                <li key={step}>{step}</li>
                              ))}
                            </ol>
                          </section>
                          <div className="hero-actions">
                            <button className="soft-action" type="button" onClick={() => handleSave(recommendation)} disabled={isBusy}>
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

        <div className="recipe-mic-dock">
          <button
            type="button"
            className={`recipe-mic-button ${isRecording ? 'is-live' : ''}`}
            onClick={isRecording ? stopListening : startListening}
            disabled={isBusy && !isRecording}
            aria-label={isRecording ? 'Stop listening' : 'Start listening'}
          >
            {isRecording ? 'Stop' : 'Mic'}
          </button>
        </div>
      </section>
    </main>
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
    <section className="detail-section">
      <span className="detail-label">{label}</span>
      {editing ? (
        <textarea
          className="recipe-inline-editor"
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
        <button type="button" className="recipe-inline-display" onDoubleClick={onBeginEdit}>
          {displayValue}
        </button>
      )}
    </section>
  );
}
