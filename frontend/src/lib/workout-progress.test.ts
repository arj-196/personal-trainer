import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  readWorkoutProgress,
  toggleWorkoutBlock,
  writeWorkoutProgress,
} from './workout-progress';

describe('workout progress storage', () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    const localStorageMock = {
      clear: () => storage.clear(),
      getItem: (key: string) => storage.get(key) ?? null,
      removeItem: (key: string) => storage.delete(key),
      setItem: (key: string, value: string) => storage.set(key, value),
    };

    vi.stubGlobal('window', { localStorage: localStorageMock });
  });

  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('writes and reads completion state by workspace and day key', () => {
    writeWorkoutProgress('wk_arj', 'Day 1', ['warmup', 'curls']);

    expect(readWorkoutProgress('wk_arj', 'Day 1')).toEqual(['warmup', 'curls']);
    expect(readWorkoutProgress('wk_arj', 'Day 2')).toEqual([]);
  });

  it('returns an empty array when the stored value is malformed', () => {
    window.localStorage.setItem(
      'personal-trainer:workout-progress:wk_arj:Day 1',
      '{"not":"an-array"}'
    );

    expect(readWorkoutProgress('wk_arj', 'Day 1')).toEqual([]);
  });
});

describe('toggleWorkoutBlock', () => {
  it('adds and removes block ids without mutating the input array', () => {
    const original = ['warmup'];

    const added = toggleWorkoutBlock(original, 'press');
    const removed = toggleWorkoutBlock(added, 'warmup');

    expect(original).toEqual(['warmup']);
    expect(added).toEqual(['warmup', 'press']);
    expect(removed).toEqual(['press']);
  });
});
