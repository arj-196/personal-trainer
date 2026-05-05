import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/trainer-data', () => ({
  listWorkspaces: vi.fn(async () => ['alpha', 'bravo']),
  readUserProfileSummary: vi.fn(async (workspace: string) => ({
    name: workspace.toUpperCase(),
    goal: 'Strength',
  })),
  readWorkoutPlan: vi.fn(async (workspace: string) => ({
    title: `${workspace} plan`,
    meta: [],
    summary: 'Train consistently.',
    progression: 'Add reps first.',
    days: [],
    nextCheckIn: 'Next Monday.',
  })),
}));

import { GET as getPlan } from '../../../app/api/mobile/workspaces/[workspace]/plan/route';
import { GET as getProfile } from '../../../app/api/mobile/workspaces/[workspace]/profile/route';
import { GET as getWorkspaces } from '../../../app/api/mobile/workspaces/route';

describe('mobile API routes', () => {
  beforeEach(() => {
    delete process.env.TRAINER_MOBILE_API_TOKEN;
  });

  it('lists workspaces without auth when no token is configured', async () => {
    const response = await getWorkspaces(new Request('http://localhost/api/mobile/workspaces'));

    await expect(response.json()).resolves.toEqual({ workspaces: ['alpha', 'bravo'] });
  });

  it('rejects requests without the configured bearer token', async () => {
    process.env.TRAINER_MOBILE_API_TOKEN = 'secret-token';

    const response = await getWorkspaces(new Request('http://localhost/api/mobile/workspaces'));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized.' });
  });

  it('allows requests with the configured bearer token', async () => {
    process.env.TRAINER_MOBILE_API_TOKEN = 'secret-token';

    const response = await getWorkspaces(new Request('http://localhost/api/mobile/workspaces', {
      headers: { authorization: 'Bearer secret-token' },
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ workspaces: ['alpha', 'bravo'] });
  });

  it('returns profile and plan payloads for a workspace', async () => {
    const context = { params: Promise.resolve({ workspace: 'alpha' }) };

    const profileResponse = await getProfile(new Request('http://localhost/api/mobile/workspaces/alpha/profile'), context);
    const planResponse = await getPlan(new Request('http://localhost/api/mobile/workspaces/alpha/plan'), context);

    await expect(profileResponse.json()).resolves.toEqual({
      profile: { name: 'ALPHA', goal: 'Strength' },
    });
    await expect(planResponse.json()).resolves.toMatchObject({
      plan: { title: 'alpha plan', days: [] },
    });
  });
});
