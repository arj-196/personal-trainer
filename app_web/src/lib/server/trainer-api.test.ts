import { afterEach, describe, expect, it, vi } from 'vitest';

import { askWorkoutSessionChat, getWorkoutPlanGeneration, startWorkoutPlanGeneration } from './trainer-api';

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

  it('sends Workout Session chat requests to the trainer service', async () => {
    vi.stubEnv('TRAINER_API_URL', 'http://trainer.test');
    vi.stubEnv('TRAINER_API_TOKEN', 'secret');
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({
        arnoldResponse: 'Arnold answer.',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    ));
    vi.stubGlobal('fetch', fetchMock);

    await expect(askWorkoutSessionChat('wk jordan', {
      dayHeading: 'Day 1',
      question: 'What muscles?',
      history: [],
    })).resolves.toEqual({
      arnoldResponse: 'Arnold answer.',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://trainer.test/workspaces/wk%20jordan/workout-session-chat',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer secret',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          dayHeading: 'Day 1',
          question: 'What muscles?',
          history: [],
        }),
      })
    );
  });
});
