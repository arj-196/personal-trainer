import { describe, expect, it } from 'vitest';

import {
  libraryImageUrl,
  listWorkspaces,
  readExerciseLibrary,
  readWorkoutPlan,
  workspaceImageUrl,
} from './trainer-data';

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

describe('trainer data integration', () => {
  it('lists fixture workspaces that contain a profile', () => {
    expect(listWorkspaces()).toContain('test1');
  });

  it('parses a generated workout plan from the repo workspace fixtures', () => {
    const plan = readWorkoutPlan('test1');

    expect(plan).not.toBeNull();
    expect(plan?.title).toBe("Alex's Training Plan");
    expect(plan?.meta).toEqual(
      expect.arrayContaining([
        { label: 'Goal', value: 'Build muscle and improve conditioning' },
        { label: 'Weekly training days', value: '4' },
      ])
    );
    expect(plan?.days).toHaveLength(4);
    expect(plan?.days[0]).toMatchObject({
      heading: 'Day 1: Upper Strength',
      warmup: expect.stringContaining('5 minutes easy cardio'),
      finisher: expect.stringContaining('bike'),
      recovery: expect.stringContaining('sharp pain'),
    });
    expect(plan?.days[0].exercises[0]).toMatchObject({
      name: 'Dumbbell Bench Press',
      prescription: '3 sets x 8-12',
      imagePath: 'exercise_library/images/dumbbell-bench-press.png',
      referencePath: 'exercise_library/dumbbell-bench-press.md',
    });
  });

  it('loads exercise references from the bundled catalog', () => {
    const exercises = readExerciseLibrary();

    expect(exercises.length).toBeGreaterThan(0);
    expect(exercises[0]).toEqual(
      expect.objectContaining({
        slug: expect.any(String),
        name: expect.any(String),
        image_filename: expect.any(String),
      })
    );
  });
});
