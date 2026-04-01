import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@vercel/blob', () => ({
  get: vi.fn(),
  list: vi.fn(),
}));

import { get, list } from '@vercel/blob';

import {
  libraryImageUrl,
  listWorkspaces,
  readRecipeCatalog,
  readUserProfileSummary,
  readExerciseLibrary,
  readWorkoutPlan,
  workspaceImageUrl,
} from './trainer-data';

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

describe('libraryImageUrl', () => {
  it('encodes the image filename', () => {
    expect(libraryImageUrl('split squat 1.png')).toBe('/api/library-images/split%20squat%201.png');
  });
});

describe('trainer data integration (local)', () => {
  beforeEach(() => {
    delete process.env.TRAINER_DATA_SOURCE;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('lists fixture workspaces that contain a profile', async () => {
    await expect(listWorkspaces()).resolves.toContain('wk_arj');
  });

  it('parses a generated workout plan from the repo workspace fixtures', async () => {
    const plan = await readWorkoutPlan('wk_arj');

    expect(plan).not.toBeNull();
    expect(plan?.title).toBe("Arj's Training Plan");
    expect(plan?.meta).toEqual(
      expect.arrayContaining([
        { label: 'Goal', value: 'Build muscle, espcially in the arms' },
        { label: 'Weekly training days', value: '3' },
      ])
    );
    expect(plan?.days).toHaveLength(3);
    expect(plan?.days[0]).toMatchObject({
      heading: expect.stringContaining('Day 1:'),
      warmup: expect.any(String),
      finisher: expect.any(String),
      recovery: expect.any(String),
    });
    expect(plan?.days[0].exercises[0]).toMatchObject({
      name: 'Dumbbell Bench Press',
      prescription: expect.stringContaining('reps'),
      imagePath: 'exercise_library/images/dumbbell-bench-press.png',
      referencePath: 'exercise_library/dumbbell-bench-press.md',
    });
    expect(plan?.days[2]).toMatchObject({
      heading: expect.stringContaining('Day 3:'),
      finisher: expect.stringContaining('density block'),
      recovery: expect.stringContaining('sleep and hydration'),
    });
    expect(plan?.days[2].exercises[0]).toMatchObject({
      name: 'Dumbbell Bench Press',
      prescription: expect.stringContaining('reps'),
      notes: expect.stringContaining('Slight pause'),
    });
  });

  it('loads exercise references from the bundled catalog', async () => {
    const exercises = await readExerciseLibrary();

    expect(exercises.length).toBeGreaterThan(0);
    expect(exercises[0]).toEqual(
      expect.objectContaining({
        slug: expect.any(String),
        name: expect.any(String),
        image_filename: expect.any(String),
      })
    );
  });

  it('loads the recipe catalog and profile summary', async () => {
    const recipes = await readRecipeCatalog();
    const profile = await readUserProfileSummary('wk_arj');

    expect(recipes.length).toBeGreaterThan(0);
    expect(recipes[0]).toEqual(
      expect.objectContaining({
        title: expect.any(String),
        ingredients_required: expect.any(Array),
      })
    );
    expect(profile).toEqual(
      expect.objectContaining({
        name: expect.any(String),
        goal: expect.any(String),
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
                  imagePath: 'exercise_library/images/goblet-squat.png',
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
            image_filename: 'goblet-squat.png',
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
        'pt-prod/recipes/catalog.json': JSON.stringify([
          {
            slug: 'egg-veggie-skillet',
            title: 'Egg and Veggie Skillet',
            summary: 'Protein-first skillet',
            meal_type: 'breakfast',
            goal_tags: ['fat loss'],
            ingredients_required: ['eggs', 'spinach'],
            ingredients_optional: ['tomato'],
            substitutions: ['Swap spinach for kale.'],
            estimated_prep_minutes: 8,
            estimated_cook_minutes: 8,
            instructions: ['Cook the eggs.'],
            nutrition_summary: 'Lighter calorie density',
            confidence_note: 'Strong fit',
          },
        ]),
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
    const recipes = await readRecipeCatalog();
    const profile = await readUserProfileSummary('alpha');

    expect(plan).toMatchObject({
      title: 'Blob Plan',
      meta: expect.arrayContaining([{ label: 'Plan version', value: '3' }]),
    });
    expect(plan?.days[0].exercises[0].imagePath).toBe('exercise_library/images/goblet-squat.png');
    expect(exercises).toHaveLength(1);
    expect(exercises[0].name).toBe('Goblet Squat');
    expect(recipes[0].title).toBe('Egg and Veggie Skillet');
    expect(profile?.goal).toBe('Fat loss');
    expect(mockedGet).toHaveBeenCalledWith('pt-prod/workspaces/alpha/plan.json', { access: 'private' });
    expect(mockedGet).toHaveBeenCalledWith('pt-prod/exercise-library/catalog.json', { access: 'private' });
    expect(mockedGet).toHaveBeenCalledWith('pt-prod/workspaces/alpha/profile.json', { access: 'private' });
    expect(mockedGet).toHaveBeenCalledWith('pt-prod/recipes/catalog.json', { access: 'private' });
  });
});
