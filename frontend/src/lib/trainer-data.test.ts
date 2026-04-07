import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@vercel/blob', () => ({
  get: vi.fn(),
  list: vi.fn(),
}));

import { get, list } from '@vercel/blob';

import {
  listWorkspaces,
  readUserProfileSummary,
  readExerciseLibrary,
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
      exercises: [
        {
          name: 'Goblet Squat',
          prescription: '3 x 10',
          notes: 'Smooth reps',
          imageUrl: 'https://example.test/squat.jpg',
          referencePath: 'exercise_library/goblet-squat.md',
        },
      ],
      finisher: 'Bike sprints',
      recovery: 'Walk and stretch',
    });

    expect(blocks.map((block) => block.kind)).toEqual(['warmup', 'exercise', 'finisher', 'recovery']);
    expect(blocks[1]).toMatchObject({
      name: 'Goblet Squat',
      imageUrl: 'https://example.test/squat.jpg',
      referencePath: 'exercise_library/goblet-squat.md',
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

  it('returns an empty local workspace list when no repo fixtures exist', async () => {
    await expect(listWorkspaces()).resolves.toEqual([]);
  });

  it('returns null for missing local workspace files', async () => {
    await expect(readWorkoutPlan('wk_arj')).resolves.toBeNull();
    await expect(readUserProfileSummary('wk_arj')).resolves.toBeNull();
  });

  it('loads exercise references from the bundled catalog', async () => {
    const exercises = await readExerciseLibrary();

    expect(exercises.length).toBeGreaterThan(0);
    expect(exercises[0]).toEqual(
      expect.objectContaining({
        slug: expect.any(String),
        name: expect.any(String),
        image_url: expect.stringContaining('https://'),
      })
    );
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

  it('reads the workout plan and exercise catalog from blob storage', async () => {
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
              exercises: [
                {
                  name: 'Goblet Squat',
                  prescription: '3 sets x 10',
                  notes: 'Smooth tempo.',
                  imageUrl: 'https://wger.de/media/exercise-images/1542/dumbbell-goblet-squat.jpeg',
                  referencePath: 'exercise_library/goblet-squat.md',
                },
              ],
              finisher: '5 minute bike',
              recovery: 'Walk and hydrate',
            },
          ],
          nextCheckIn: 'Next Monday.',
        }),
        'pt-prod/exercise-library/catalog.json': JSON.stringify([
          {
            slug: 'goblet-squat',
            name: 'Goblet Squat',
            aliases: [],
            summary: 'Leg exercise',
            setup: 'Hold a dumbbell',
            cues: ['Brace'],
            visual_note: '',
            image_url: 'https://wger.de/media/exercise-images/1542/dumbbell-goblet-squat.jpeg',
            source_title: '',
            source_url: '',
            author: '',
            credit: '',
            license: 'CC',
            license_url: '',
          },
        ]),
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
    const exercises = await readExerciseLibrary();
    const profile = await readUserProfileSummary('alpha');

    expect(plan).toMatchObject({
      title: 'Blob Plan',
      meta: expect.arrayContaining([{ label: 'Plan version', value: '3' }]),
    });
    expect(plan?.days[0].exercises[0].imageUrl).toBe(
      'https://wger.de/media/exercise-images/1542/dumbbell-goblet-squat.jpeg'
    );
    expect(exercises).toHaveLength(1);
    expect(exercises[0].name).toBe('Goblet Squat');
    expect(profile?.goal).toBe('Fat loss');
    expect(mockedGet).toHaveBeenCalledWith('pt-prod/workspaces/alpha/plan.json', { access: 'private' });
    expect(mockedGet).toHaveBeenCalledWith('pt-prod/exercise-library/catalog.json', { access: 'private' });
    expect(mockedGet).toHaveBeenCalledWith('pt-prod/workspaces/alpha/profile.json', { access: 'private' });
  });
});
