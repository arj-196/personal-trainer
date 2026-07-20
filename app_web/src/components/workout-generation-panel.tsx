'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import type {
  WorkoutGenerationJob,
  WorkoutGenerationReview,
} from '@/lib/server/trainer-api';
import {
  Button,
  ButtonLink,
  Card,
  Chip,
  Display,
  ErrorBanner,
  Kicker,
  Spinner,
  cx,
} from '@/components/ui';

type Props = {
  workspace: string;
  /** Current plan title, when one exists — drives the regenerate affordance. */
  planTitle?: string | null;
  /** Short meta line shown under the plan title (e.g. "4 weeks · 4 days/week"). */
  planMetaShort?: string | null;
};

const JOB_PILL: Record<string, { label: string; className: string }> = {
  queued: { label: 'Queued', className: 'bg-bg2 text-mut border border-ln2' },
  running: { label: '● Running', className: 'bg-gold-soft text-gold-deep border border-gold' },
  succeeded: { label: '✓ Succeeded', className: 'bg-teal-soft text-teal-deep border border-teal' },
  failed: { label: '✕ Failed', className: 'bg-err-soft text-err border border-err-line' },
};

export function WorkoutGenerationPanel({ workspace, planTitle, planMetaShort }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const isOnPlanPage = pathname?.startsWith('/workout/') ?? false;
  const [job, setJob] = useState<WorkoutGenerationJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [, startTransition] = useTransition();

  const active = job?.status === 'queued' || job?.status === 'running';
  const hasPlan = Boolean(planTitle);
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
    setConfirming(false);
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

  const pill = job ? JOB_PILL[job.status] : null;

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <Display as="h2" className="text-[16px] font-bold">
          Workout Plan
        </Display>
        {pill ? (
          <span
            className={cx(
              'whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold',
              pill.className,
            )}
          >
            {pill.label}
          </span>
        ) : null}
      </div>

      {hasPlan ? (
        <div className="flex items-center justify-between gap-2.5">
          <div className="min-w-0 flex-1">
            <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[14px] font-bold">
              {planTitle}
            </div>
            {planMetaShort ? <div className="text-[12px] text-fnt">{planMetaShort}</div> : null}
          </div>
          {!confirming && !active ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-[38px] whitespace-nowrap"
              disabled={starting}
              onClick={() => setConfirming(true)}
            >
              Regenerate…
            </Button>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <ErrorBanner onRetry={() => void startGeneration()}>{error}</ErrorBanner>
      ) : null}

      {confirming && !active ? (
        <div className="flex flex-col gap-2.5 rounded-[14px] border border-gold bg-gold-soft px-3.5 py-3">
          <div className="text-[12.5px] leading-relaxed text-gold-deep">
            <b>Generate a new plan?</b>{' '}
            {hasPlan
              ? `This drafts a replacement for “${planTitle}”.`
              : 'The coach drafts your first multi-week plan from the athlete profile.'}{' '}
            It takes a few minutes and can&apos;t be paused.
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="accent"
              size="sm"
              className="h-10 px-4"
              disabled={starting}
              onClick={() => void startGeneration()}
            >
              Yes, generate
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10 px-3.5"
              onClick={() => setConfirming(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {!confirming && !active && hasPlan && !isOnPlanPage && job?.status !== 'succeeded' ? (
        <ButtonLink variant="ink" href={`/workout/${encodeURIComponent(workspace)}`} className="w-full font-display text-[14px]">
          Open plan →
        </ButtonLink>
      ) : null}

      {!confirming && !active && !hasPlan ? (
        <>
          <Button
            type="button"
            variant="accent"
            size="lg"
            disabled={starting}
            onClick={() => setConfirming(true)}
          >
            {starting ? 'Starting…' : 'Generate my first plan'}
          </Button>
          <div className="text-[11.5px] leading-relaxed text-fnt">
            Takes a few minutes. The coach drafts, an AI reviewer pushes back, the coach revises.
            You&apos;ll see all of it.
          </div>
        </>
      ) : null}

      {active && job ? (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2.5 rounded-[14px] bg-bg2 px-3.5 py-3">
            <Spinner />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-bold">{job.currentStep.replaceAll('_', ' ')}</div>
              <div className="text-[11px] text-fnt">
                Plan v{job.targetPlanVersion} · polling every 2 s
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            {latestSteps.map((step, index) => {
              const isDone = step.status === 'completed';
              const isFailed = step.status === 'failed';
              const isLast = index === latestSteps.length - 1;
              return (
                <div key={`${step.createdAt}-${step.step}-${index}`} className="flex items-center gap-2">
                  <div
                    className={cx(
                      'flex h-4 w-4 flex-none items-center justify-center rounded-full text-[9px] text-white',
                      isDone ? 'bg-teal' : isFailed ? 'bg-err' : isLast ? 'bg-gold' : 'border border-ln2',
                    )}
                  >
                    {isDone ? '✓' : isFailed ? '✕' : ''}
                  </div>
                  <div className="flex-1 text-[12.5px] text-ink">{step.label}</div>
                  <div className="text-[10.5px] text-fnt">{step.status}</div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {job && job.reviewFeed.length > 0 ? (
        <div className="flex flex-col gap-2">
          <Kicker>AI review feed</Kicker>
          {job.reviewFeed.map((review) => (
            <ReviewCard key={`${review.iteration}-${review.reviewer}`} review={review} />
          ))}
        </div>
      ) : null}

      {job?.status === 'succeeded' ? (
        <div className="flex items-center gap-2.5 rounded-[14px] border border-teal bg-teal-soft px-3.5 py-3">
          <div className="flex-1 text-[13px] font-semibold text-teal-deep">
            Plan v{job.targetPlanVersion} published. Time to work.
          </div>
          <ButtonLink
            variant="ink"
            size="sm"
            className="h-9 whitespace-nowrap"
            href={`/workout/${encodeURIComponent(workspace)}`}
          >
            View →
          </ButtonLink>
        </div>
      ) : null}

      {job?.status === 'failed' && !confirming ? (
        <ErrorBanner onRetry={() => setConfirming(true)} retryLabel="Try again">
          Generation failed mid-lift. The plan you had (if any) is untouched.
        </ErrorBanner>
      ) : null}
    </Card>
  );
}

function ReviewCard({ review }: { review: WorkoutGenerationReview }) {
  const isApproved = /approve/i.test(review.status);
  return (
    <article className="flex flex-col gap-1.5 rounded-[14px] border border-ln bg-bg2 px-3.5 py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[12.5px] font-bold">
          {review.reviewer} · iteration {review.iteration}
        </div>
        <Chip tone={isApproved ? 'teal' : 'gold'} className="text-[10px] font-bold">
          {review.status.replaceAll('_', ' ')}
        </Chip>
      </div>
      <p className="m-0 text-[12px] leading-relaxed text-mut">{review.reasoningSummary}</p>
      {review.blockingIssues.length > 0 ? (
        <div className="flex flex-col gap-0.5">
          {review.blockingIssues.map((issue) => (
            <div key={issue} className="text-[11.5px] text-err">
              ⚠ {issue}
            </div>
          ))}
        </div>
      ) : null}
      {review.suggestedChanges.length > 0 ? (
        <div className="flex flex-col gap-0.5">
          {review.suggestedChanges.map((change) => (
            <div key={change} className="text-[11.5px] text-teal-deep">
              → {change}
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}
