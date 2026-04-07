'use client';

import Link from 'next/link';

import { useMicrophoneRecorder } from '@/lib/recipes/use-microphone-recorder';

export default function DebugPage() {
  const {
    error,
    isRecording,
    recordingUrl,
    startRecording,
    stopRecording,
  } = useMicrophoneRecorder();

  return (
    <main className="shell">
      <section className="hero-panel hero-panel-compact">
        <div className="hero-topline">
          <div>
            <p className="section-kicker">Debug</p>
            <h1 className="hero-title recipe-hero-title">Feature Verification</h1>
          </div>
          <div className="hero-avatar" aria-hidden="true">DB</div>
        </div>
        <p className="hero-subtitle">
          Use this route to validate production feature implementations on different devices.
        </p>
        <div className="hero-actions">
          <Link className="soft-action" href="/">
            Workout View
          </Link>
          <Link className="soft-action" href="/recipes">
            Recipes
          </Link>
        </div>
      </section>

      <section className="panel-card">
        <div className="section-head">
          <div>
            <h2 className="section-title">Mic Capture Test</h2>
            <p className="section-copy">
              Status: <strong>{isRecording ? 'Listening...' : 'Ready'}</strong>
            </p>
          </div>
        </div>

        <div className="story-card">
          <p className="section-copy">
            Record audio, stop, then use playback to verify microphone capture on this device.
          </p>
          <div className="hero-actions">
            <button
              type="button"
              className={`recipe-mic-button ${isRecording ? 'is-live' : ''}`}
              onClick={isRecording ? stopRecording : startRecording}
              aria-label={isRecording ? 'Stop listening' : 'Start listening'}
            >
              {isRecording ? 'Stop' : 'Mic'}
            </button>
          </div>
        </div>

        {error ? (
          <div className="recipe-feedback is-error">
            {error}
          </div>
        ) : null}

        {recordingUrl ? (
          <div className="story-card">
            <strong>Latest Recording</strong>
            <audio controls src={recordingUrl} style={{ width: '100%', marginTop: 10 }}>
              Your browser does not support audio playback.
            </audio>
          </div>
        ) : (
          <div className="empty-state">
            <h3 className="section-title">No recording yet</h3>
            <p>Start and stop the mic to generate the latest playback sample.</p>
          </div>
        )}
      </section>
    </main>
  );
}
