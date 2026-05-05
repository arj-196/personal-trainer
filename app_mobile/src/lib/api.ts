import type {
  MobilePlanResponse,
  MobileProfileResponse,
  MobileWorkspacesResponse,
} from '@personal-trainer/shared/api';
import type { UserProfileSummary, WorkoutPlan } from '@personal-trainer/shared/workout';

// Local Expo development talks to the web app on localhost. Preview and production
// iPhone builds should override this with EXPO_PUBLIC_TRAINER_API_BASE_URL.
const DEFAULT_API_BASE_URL = 'http://localhost:3000';

function apiBaseUrl(): string {
  return (process.env.EXPO_PUBLIC_TRAINER_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL).replace(/\/+$/, '');
}

function apiHeaders(): HeadersInit {
  const token = process.env.EXPO_PUBLIC_TRAINER_API_TOKEN?.trim();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    headers: apiHeaders(),
  });
  const payload = await response.json();

  if (!response.ok) {
    const message = typeof payload?.error === 'string' ? payload.error : 'Mobile API request failed.';
    throw new Error(message);
  }

  return payload as T;
}

export async function fetchMobileWorkspaces(): Promise<string[]> {
  const payload = await fetchJson<MobileWorkspacesResponse>('/api/mobile/workspaces');
  return payload.workspaces;
}

export async function fetchMobileProfile(workspace: string): Promise<UserProfileSummary | null> {
  const payload = await fetchJson<MobileProfileResponse>(
    `/api/mobile/workspaces/${encodeURIComponent(workspace)}/profile`
  );
  return payload.profile;
}

export async function fetchMobilePlan(workspace: string): Promise<WorkoutPlan | null> {
  const payload = await fetchJson<MobilePlanResponse>(
    `/api/mobile/workspaces/${encodeURIComponent(workspace)}/plan`
  );
  return payload.plan;
}
