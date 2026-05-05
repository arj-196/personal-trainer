'use client';

import Link from 'next/link';
import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';

import { useMicrophoneRecorder } from '@/lib/recipes/use-microphone-recorder';

const shellClass = 'mx-auto w-full max-w-6xl px-4 pb-[calc(68px+22px+24px+env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:pt-5';
const heroClass = 'rounded-[1.75rem] border border-white/70 bg-[linear-gradient(150deg,rgba(255,255,255,0.94),rgba(255,244,234,0.9)),linear-gradient(180deg,#fff,#f6f0e8)] p-5 shadow-[0_20px_45px_rgba(41,51,64,0.08)] backdrop-blur-xl sm:p-6';
const cardClass = 'mt-4 rounded-[1.75rem] border border-white/70 bg-white/80 p-5 shadow-[0_20px_45px_rgba(41,51,64,0.08)] backdrop-blur-xl sm:p-6';
const kickerClass = 'mb-2 text-xs font-bold uppercase tracking-[0.16em] text-[#ff6359]';
const heroTitleClass = 'm-0 font-["Avenir_Next_Condensed","Arial_Narrow",sans-serif] leading-[0.95] tracking-[-0.03em] text-[clamp(2rem,10vw,3.4rem)]';
const sectionTitleClass = 'm-0 font-["Avenir_Next_Condensed","Arial_Narrow",sans-serif] leading-none tracking-[-0.03em] text-[clamp(1.4rem,5vw,2rem)]';
const copyClass = 'm-0 text-sm leading-relaxed text-slate-500';
const softActionClass = 'inline-flex min-h-11 items-center justify-center rounded-full border border-slate-300/60 bg-white/75 px-4 py-2.5 text-sm font-bold text-slate-800 transition hover:-translate-y-0.5';

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
    <main className={shellClass}>
      <section className={heroClass}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className={kickerClass}>Debug</p>
            <h1 className={heroTitleClass}>Feature Verification</h1>
          </div>
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-gradient-to-br from-white/95 to-slate-100/90 text-sm font-extrabold tracking-[0.08em] text-slate-800 shadow-[0_12px_24px_rgba(43,52,61,0.1)]">DB</div>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-slate-500">
          Use this route to validate production feature implementations on different devices.
        </p>
        <div className="mt-4 flex flex-wrap gap-2.5">
          <Link className={softActionClass} href="/">
            Workout View
          </Link>
          <Link className={softActionClass} href="/recipes">
            Recipes
          </Link>
        </div>
      </section>

      <section className={cardClass}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className={sectionTitleClass}>Mic Capture Test</h2>
            <p className={copyClass}>
              Status: <strong>{isRecording ? 'Listening...' : 'Ready'}</strong>
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-[1.5rem] border border-slate-200/70 bg-white/75 p-4">
          <p className={copyClass}>
            Record audio, stop, then use playback to verify microphone capture on this device.
          </p>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl bg-[#ffe4df] px-4 py-3 text-sm text-[#8f2d1f]">
            {error}
          </div>
        ) : null}

        {recordingUrl ? (
          <div className="mt-4 rounded-[1.5rem] border border-slate-200/70 bg-white/75 p-4">
            <strong className="mb-2 block">Latest Recording</strong>
            <audio controls src={recordingUrl} className="mt-2 w-full">
              Your browser does not support audio playback.
            </audio>
          </div>
        ) : (
          <div className="mt-4 rounded-[1.5rem] border border-white/70 bg-white/80 p-4">
            <h3 className={sectionTitleClass}>No recording yet</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">Start and stop the mic to generate the latest playback sample.</p>
          </div>
        )}

      </section>

      {isClient ? createPortal(
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(22px+env(safe-area-inset-bottom))] z-[2147483647] flex justify-center sm:bottom-[calc(18px+env(safe-area-inset-bottom))]">
          <button
            type="button"
            className={[
              'pointer-events-auto grid h-[68px] w-[68px] place-items-center rounded-full border-0 text-white shadow-[0_22px_60px_rgba(20,24,30,0.16)]',
              isRecording ? 'bg-[#c8362f]' : 'bg-[#17181c]',
            ].join(' ')}
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
