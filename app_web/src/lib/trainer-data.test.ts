import { describe, expect, it, vi } from 'vitest';

const {
  listWorkspacesMock,
  readUserProfileSummaryMock,
  readWorkoutPlanMock,
} = vi.hoisted(() => ({
  listWorkspacesMock: vi.fn(),
  readUserProfileSummaryMock: vi.fn(),
  readWorkoutPlanMock: vi.fn(),
}));

vi.mock('./server/workspaces', () => ({
  listWorkspaces: listWorkspacesMock,
  readUserProfileSummary: readUserProfileSummaryMock,
  readWorkoutPlan: readWorkoutPlanMock,
}));

import {
  listWorkspaces,
  readUserProfileSummary,
  readWorkoutPlan,
  workspaceImageUrl,
} from './trainer-data';
import { buildWorkoutDayBlocks, googleImagesSearchUrl } from './workout-helpers';

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

describe('trainer data integration', () => {
  it('lists workspaces from the server repository', async () => {
    listWorkspacesMock.mockResolvedValue(['wk_arj']);

    await expect(listWorkspaces()).resolves.toEqual(['wk_arj']);
  });

  it('returns null for missing workspace records', async () => {
    readWorkoutPlanMock.mockResolvedValue(null);
    readUserProfileSummaryMock.mockResolvedValue(null);

    await expect(readWorkoutPlan('missing')).resolves.toBeNull();
    await expect(readUserProfileSummary('missing')).resolves.toBeNull();
  });

  it('normalizes workout plans returned by the repository', async () => {
    readWorkoutPlanMock.mockResolvedValue({
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

    const plan = await readWorkoutPlan('alpha');
    expect(plan?.days[0].warmupActiveSeconds).toBe(300);
    expect(plan?.days[0].exercises[0].sets).toBe(3);
    expect(plan?.days[0].finisherActiveSeconds).toBe(300);
    expect(plan?.days[0].recoveryActiveSeconds).toBe(300);
  });
});
