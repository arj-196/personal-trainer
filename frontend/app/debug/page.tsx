'use client';

import Link from 'next/link';
import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';

import { useMicrophoneRecorder } from '@/lib/recipes/use-microphone-recorder';

export default function DebugPage() {
  const [isClient, setIsClient] = useState(false);
  const {
    error,
    isRecording,
    recordingUrl,
    startRecording,
    stopRecording,
  } = useMicrophoneRecorder();

  useEffect(() => {
    setIsClient(true);
  }, []);

  return (
    <main className="shell shell-with-mic-fab">
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

      {isClient ? createPortal(
        <div className="recipe-mic-dock">
          <button
            type="button"
            className={`recipe-mic-button ${isRecording ? 'is-live' : ''}`}
            onClick={isRecording ? stopRecording : startRecording}
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
      className="recipe-mic-icon"
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
