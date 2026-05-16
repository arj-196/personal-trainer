'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import type {
  WorkoutGenerationJob,
  WorkoutGenerationReview,
} from '@/lib/server/trainer-api';

type Props = {
  workspace: string;
  variant?: 'compact' | 'empty';
};

const primaryActionClass = 'inline-flex min-h-11 items-center justify-center rounded-full border border-transparent bg-gradient-to-br from-[#ff6a60] to-[#ff7f5d] px-4 py-2.5 text-sm font-bold text-white shadow-[0_12px_24px_rgba(255,99,89,0.24)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0';
const softActionClass = 'inline-flex min-h-11 items-center justify-center rounded-full border border-slate-300/60 bg-white/75 px-4 py-2.5 text-sm font-bold text-slate-800 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0';

export function WorkoutGenerationPanel({ workspace, variant = 'compact' }: Props) {
  const router = useRouter();
  const [job, setJob] = useState<WorkoutGenerationJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [isPending, startTransition] = useTransition();
  const active = job?.status === 'queued' || job?.status === 'running';
  const title = variant === 'empty' ? 'Generate your first Workout Plan' : 'Generate new Workout Plan';
  const latestSteps = useMemo(() => job?.stepHistory.slice(-8) ?? [], [job]);

  useEffect(() => {
    let cancelled = false;
    async function loadActiveJob() {
      try {
        const response = await fetch(`/api/workout-generation/${encodeURIComponent(workspace)}`, {
          cache: 'no-store',
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || 'Could not read active generation status.');
        }
        if (!cancelled && payload.job) {
          setJob(payload.job);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : 'Could not read active generation status.');
        }
      }
    }
    void loadActiveJob();
    return () => {
      cancelled = true;
    };
  }, [workspace]);

  useEffect(() => {
    if (!job || !active) {
      return;
    }
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/workout-generation/jobs/${encodeURIComponent(job.id)}`, {
          cache: 'no-store',
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || 'Could not refresh generation status.');
        }
        setJob(payload.job);
        if (payload.job.status === 'succeeded') {
          startTransition(() => router.refresh());
        }
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Could not refresh generation status.');
      }
    }, 2000);
    return () => window.clearInterval(timer);
  }, [active, job, router]);

  async function startGeneration() {
    setStarting(true);
    setError(null);
    try {
      const response = await fetch(`/api/workout-generation/${encodeURIComponent(workspace)}`, {
        method: 'POST',
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Could not start Workout Plan generation.');
      }
      setJob(payload.job);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not start Workout Plan generation.');
    } finally {
      setStarting(false);
    }
  }

  return (
    <section className={[
      'rounded-[1.5rem] border p-4',
      variant === 'empty'
        ? 'border-[#ff7f5d]/35 bg-gradient-to-b from-white/95 to-orange-50/80'
        : 'border-slate-200/70 bg-white/75',
    ].join(' ')}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-[#ff6359]">Plan generation</p>
          <h2 className="m-0 font-[Avenir_Next_Condensed,Arial_Narrow,sans-serif] text-[clamp(1.35rem,4vw,2rem)] leading-none">{title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
            Save your Athlete Profile and Check-in, then request a fresh plan. The trainer service will draft,
            review, revise, and publish the next current Workout Plan.
          </p>
        </div>
        <button
          className={primaryActionClass}
          disabled={starting || active || isPending}
          type="button"
          onClick={startGeneration}
        >
          {active ? 'Generation running' : starting ? 'Starting...' : 'Generate'}
        </button>
      </div>

      {error ? (
        <p className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </p>
      ) : null}

      {job ? (
        <div className="mt-4 grid gap-3">
          <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong className="text-sm text-slate-900">Version {job.targetPlanVersion}</strong>
              <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-white">
                {job.status}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-500">Current step: {job.currentStep.replaceAll('_', ' ')}</p>
          </div>

          <div className="grid gap-2">
            {latestSteps.map((step, index) => (
              <div key={`${step.createdAt}-${step.step}-${index}`} className="flex gap-3 rounded-2xl border border-slate-200/70 bg-white/80 p-3">
                <span className={[
                  'mt-0.5 h-3 w-3 shrink-0 rounded-full',
                  step.status === 'completed' ? 'bg-emerald-500' : step.status === 'failed' ? 'bg-red-500' : 'bg-[#ff7f5d]',
                ].join(' ')} />
                <div>
                  <p className="m-0 text-sm font-bold text-slate-900">{step.label}</p>
                  <p className="m-0 text-xs uppercase tracking-[0.08em] text-slate-500">{step.status}</p>
                </div>
              </div>
            ))}
          </div>

          {job.reviewFeed.length > 0 ? (
            <div className="grid gap-2">
              {job.reviewFeed.map((review) => (
                <ReviewCard key={`${review.iteration}-${review.reviewer}`} review={review} />
              ))}
            </div>
          ) : null}

          {job.status === 'succeeded' ? (
            <button className={softActionClass} type="button" onClick={() => startTransition(() => router.refresh())}>
              Refresh current plan
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function ReviewCard({ review }: { review: WorkoutGenerationReview }) {
  return (
    <article className="rounded-2xl border border-slate-200/70 bg-white/85 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <strong className="text-sm text-slate-900">{review.reviewer} · iteration {review.iteration}</strong>
        <span className="rounded-full bg-[#ff6359]/12 px-3 py-1 text-xs font-bold text-[#b54843]">
          {review.status.replaceAll('_', ' ')}
        </span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{review.reasoningSummary}</p>
      {review.blockingIssues.length > 0 ? (
        <p className="mt-2 text-sm text-slate-600">
          <strong>Blocking issues:</strong> {review.blockingIssues.join(' ')}
        </p>
      ) : null}
      {review.suggestedChanges.length > 0 ? (
        <p className="mt-2 text-sm text-slate-600">
          <strong>Suggested changes:</strong> {review.suggestedChanges.join(' ')}
        </p>
      ) : null}
    </article>
  );
}
