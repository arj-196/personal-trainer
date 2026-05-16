import { afterEach, describe, expect, it, vi } from 'vitest';

import { getWorkoutPlanGeneration, startWorkoutPlanGeneration } from './trainer-api';

describe('trainer api client', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('starts a Workout Plan generation through the configured trainer service', async () => {
    vi.stubEnv('TRAINER_API_URL', 'http://trainer.test/');
    vi.stubEnv('TRAINER_API_TOKEN', 'secret');
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({ job: { id: 'job-1', status: 'queued' }, created: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    ));
    vi.stubGlobal('fetch', fetchMock);

    await expect(startWorkoutPlanGeneration('wk jordan')).resolves.toMatchObject({
      created: true,
      job: { id: 'job-1' },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://trainer.test/workspaces/wk%20jordan/workout-plan-generations',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer secret' }),
      })
    );
  });

  it('raises trainer API errors with service detail', async () => {
    vi.stubEnv('TRAINER_API_URL', 'http://trainer.test');
    vi.stubEnv('TRAINER_API_TOKEN', 'secret');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ detail: 'Generation job not found.' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    )));

    await expect(getWorkoutPlanGeneration('missing')).rejects.toThrow('Generation job not found.');
  });
});
