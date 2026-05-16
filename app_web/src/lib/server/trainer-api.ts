import { createLogger } from './logger';

const logger = createLogger('app_web.server.trainer-api');

export type WorkoutGenerationStep = {
  step: string;
  status: string;
  label: string;
  createdAt: string;
};

export type WorkoutGenerationReview = {
  iteration: number;
  reviewer: string;
  status: string;
  reasoningSummary: string;
  blockingIssues: string[];
  suggestedChanges: string[];
  createdAt: string;
};

export type WorkoutGenerationJob = {
  id: string;
  workspace: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  currentStep: string;
  targetPlanVersion: number;
  plannerProvider: string;
  plannerModel: string;
  workoutPlanId: string | null;
  stepHistory: WorkoutGenerationStep[];
  reviewFeed: WorkoutGenerationReview[];
  errorMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  updatedAt: string;
};

export type WorkoutGenerationStartResponse = {
  job: WorkoutGenerationJob;
  created: boolean;
};

function getTrainerApiUrl(): string {
  const value = process.env.TRAINER_API_URL?.trim();
  if (!value) {
    throw new Error('TRAINER_API_URL is required.');
  }
  return value.replace(/\/+$/, '');
}

function getTrainerApiToken(): string {
  const value = process.env.TRAINER_API_TOKEN?.trim();
  if (!value) {
    throw new Error('TRAINER_API_TOKEN is required.');
  }
  return value;
}

async function trainerFetch<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${getTrainerApiUrl()}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${getTrainerApiToken()}`,
      ...(init.headers ?? {}),
    },
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof payload.detail === 'string'
      ? payload.detail
      : typeof payload.error === 'string'
        ? payload.error
        : 'Trainer API request failed.';
    logger.error('Trainer API request failed', { path, status: response.status, message });
    throw new Error(message);
  }
  return payload as T;
}

export async function startWorkoutPlanGeneration(workspace: string): Promise<WorkoutGenerationStartResponse> {
  return trainerFetch<WorkoutGenerationStartResponse>(
    `/workspaces/${encodeURIComponent(workspace)}/workout-plan-generations`,
    { method: 'POST' }
  );
}

export async function getWorkoutPlanGeneration(jobId: string): Promise<{ job: WorkoutGenerationJob }> {
  return trainerFetch<{ job: WorkoutGenerationJob }>(
    `/workout-plan-generations/${encodeURIComponent(jobId)}`,
    { method: 'GET' }
  );
}

export async function getActiveWorkoutPlanGeneration(workspace: string): Promise<{ job: WorkoutGenerationJob | null }> {
  return trainerFetch<{ job: WorkoutGenerationJob | null }>(
    `/workspaces/${encodeURIComponent(workspace)}/workout-plan-generations/active`,
    { method: 'GET' }
  );
}
