import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@vercel/blob', () => ({
  get: vi.fn(),
  list: vi.fn(),
}));

import { get, list } from '@vercel/blob';

import {
  listWorkspaces,
  readUserProfileSummary,
  readWorkoutPlan,
  workspaceImageUrl,
} from './trainer-data';
import { buildWorkoutDayBlocks, googleImagesSearchUrl } from './workout-helpers';

const mockedGet = vi.mocked(get);
const mockedList = vi.mocked(list);

describe('workspaceImageUrl', () => {
  it('returns null when the relative path is absent', () => {
    expect(workspaceImageUrl('wk_arj', null)).toBeNull();
  });

  it('encodes the workspace and each path segment independently', () => {
    expect(workspaceImageUrl('team alpha', 'exercise_library/images/my photo #1.png')).toBe(
      '/api/workspace-images/team%20alpha/exercise_library/images/my%20photo%20%231.png'
    );
  });
});

describe('googleImagesSearchUrl', () => {
  it('encodes the exercise name into a Google Images query url', () => {
    expect(googleImagesSearchUrl('Incline Dumbbell Press')).toBe(
      'https://www.google.com/search?tbm=isch&q=Incline%20Dumbbell%20Press'
    );
  });
});

describe('buildWorkoutDayBlocks', () => {
  it('prepends warm-up and appends finisher and recovery blocks', () => {
    const blocks = buildWorkoutDayBlocks({
      heading: 'Day 1',
      warmup: '5 minute bike',
      warmupActiveSeconds: 300,
      exercises: [
        {
          name: 'Goblet Squat',
          prescription: '3 x 10',
          notes: 'Smooth reps',
          sets: 3,
          activeSeconds: 45,
          restBetweenSetsSeconds: 90,
          restBetweenExercisesSeconds: 120,
          imageUrl: 'https://example.test/squat.jpg',
        },
      ],
      finisher: 'Bike sprints',
      finisherActiveSeconds: 240,
      recovery: 'Walk and stretch',
      recoveryActiveSeconds: 180,
    });

    expect(blocks.map((block) => block.kind)).toEqual(['warmup', 'exercise', 'finisher', 'recovery']);
    expect(blocks[1]).toMatchObject({
      name: 'Goblet Squat',
      activeSeconds: 45,
      setCount: 3,
      imageUrl: 'https://example.test/squat.jpg',
    });
  });
});

describe('trainer data integration (local)', () => {
  beforeEach(() => {
    delete process.env.TRAINER_DATA_SOURCE;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('lists local workspaces from repo fixtures', async () => {
    const workspaces = await listWorkspaces();
    expect(workspaces).toEqual(expect.arrayContaining(['wk_arj']));
  });

  it('returns null for missing local workspace files', async () => {
    await expect(readWorkoutPlan('workspace_that_does_not_exist')).resolves.toBeNull();
    await expect(readUserProfileSummary('workspace_that_does_not_exist')).resolves.toBeNull();
  });

});

describe('trainer data integration (blob)', () => {
  beforeEach(() => {
    process.env.TRAINER_DATA_SOURCE = 'blob';
    process.env.TRAINER_BLOB_PREFIX = 'pt-prod';
    process.env.TRAINER_BLOB_ACCESS = 'private';
    mockedList.mockReset();
    mockedGet.mockReset();
  });

  afterEach(() => {
    delete process.env.TRAINER_DATA_SOURCE;
    delete process.env.TRAINER_BLOB_PREFIX;
    delete process.env.TRAINER_BLOB_ACCESS;
  });

  it('lists blob-backed workspaces from folded folder results', async () => {
    mockedList.mockResolvedValue({
      blobs: [],
      cursor: undefined,
      hasMore: false,
      folders: ['pt-prod/workspaces/bravo/', 'pt-prod/workspaces/alpha/'],
    });

    await expect(listWorkspaces()).resolves.toEqual(['alpha', 'bravo']);
    expect(mockedList).toHaveBeenCalledWith({
      cursor: undefined,
      prefix: 'pt-prod/workspaces/',
      mode: 'folded',
    });
  });

  it('reads the workout plan from blob storage', async () => {
    mockedGet.mockImplementation(async (pathname) => {
      const textByPath: Record<string, string> = {
        'pt-prod/workspaces/alpha/plan.json': JSON.stringify({
          title: 'Blob Plan',
          meta: [
            { label: 'Generated on', value: '2026-03-30' },
            { label: 'Plan version', value: '3' },
          ],
          summary: 'Stay consistent.',
          progression: 'Add reps first.',
          days: [
            {
              heading: 'Day 1: Full Body',
              warmup: '5 minutes',
              warmupActiveSeconds: 300,
              exercises: [
                {
                  name: 'Goblet Squat',
                  prescription: '3 sets x 10',
                  notes: 'Smooth tempo.',
                  sets: 3,
                  activeSeconds: 45,
                  restBetweenSetsSeconds: 90,
                  restBetweenExercisesSeconds: 120,
                  imageUrl: 'https://wger.de/media/exercise-images/1542/dumbbell-goblet-squat.jpeg',
                },
              ],
              finisher: '5 minute bike',
              finisherActiveSeconds: 240,
              recovery: 'Walk and hydrate',
              recoveryActiveSeconds: 180,
            },
          ],
          nextCheckIn: 'Next Monday.',
        }),
        'pt-prod/workspaces/alpha/profile.json': JSON.stringify({
          name: 'Alpha',
          goal: 'Fat loss',
        }),
      };

      const text = textByPath[pathname];
      if (!text) {
        return null;
      }

      return {
        statusCode: 200 as const,
        stream: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(text));
            controller.close();
          },
        }),
        headers: new Headers(),
        blob: {
          url: `https://example.test/${pathname}`,
          downloadUrl: `https://example.test/download/${pathname}`,
          pathname,
          contentDisposition: 'inline',
          cacheControl: 'public, max-age=3600',
          uploadedAt: new Date('2026-03-30T00:00:00Z'),
          etag: 'etag',
          contentType: pathname.endsWith('.json') ? 'application/json' : 'text/markdown',
          size: text.length,
        },
      };
    });

    const plan = await readWorkoutPlan('alpha');
    const profile = await readUserProfileSummary('alpha');

    expect(plan).toMatchObject({
      title: 'Blob Plan',
      meta: expect.arrayContaining([{ label: 'Plan version', value: '3' }]),
    });
    expect(plan?.days[0].exercises[0].imageUrl).toBe(
      'https://wger.de/media/exercise-images/1542/dumbbell-goblet-squat.jpeg'
    );
    expect(plan?.days[0].exercises[0].activeSeconds).toBe(45);
    expect(profile?.goal).toBe('Fat loss');
    expect(mockedGet).toHaveBeenCalledWith('pt-prod/workspaces/alpha/plan.json', { access: 'private' });
    expect(mockedGet).toHaveBeenCalledWith('pt-prod/workspaces/alpha/profile.json', { access: 'private' });
  });

  it('applies timing defaults for legacy plans that do not include stopwatch fields', async () => {
    mockedGet.mockImplementation(async (pathname) => {
      if (pathname !== 'pt-prod/workspaces/alpha/plan.json') {
        return null;
      }

      const text = JSON.stringify({
        title: 'Legacy Plan',
        meta: [],
        summary: 'Legacy summary',
        progression: 'Legacy progression',
        days: [
          {
            heading: 'Day 1: Full Body',
            warmup: '5 minutes',
            exercises: [
              {
                name: 'Goblet Squat',
                prescription: '3 sets x 10',
                notes: 'Smooth tempo.',
                imageUrl: 'https://wger.de/media/exercise-images/1542/dumbbell-goblet-squat.jpeg',
              },
            ],
            finisher: '5 minute bike',
            recovery: 'Walk and hydrate',
          },
        ],
        nextCheckIn: 'Next Monday.',
      });

      return {
        statusCode: 200 as const,
        stream: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(text));
            controller.close();
          },
        }),
        headers: new Headers(),
        blob: {
          url: `https://example.test/${pathname}`,
          downloadUrl: `https://example.test/download/${pathname}`,
          pathname,
          contentDisposition: 'inline',
          cacheControl: 'public, max-age=3600',
          uploadedAt: new Date('2026-03-30T00:00:00Z'),
          etag: 'etag',
          contentType: 'application/json',
          size: text.length,
        },
      };
    });

    const plan = await readWorkoutPlan('alpha');
    expect(plan?.days[0].warmupActiveSeconds).toBe(300);
    expect(plan?.days[0].exercises[0].sets).toBe(3);
    expect(plan?.days[0].finisherActiveSeconds).toBe(300);
    expect(plan?.days[0].recoveryActiveSeconds).toBe(300);
  });
});
