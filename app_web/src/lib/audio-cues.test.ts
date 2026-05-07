import { describe, expect, it, vi } from 'vitest';

import { playExerciseStartCue } from './audio-cues';

describe('playExerciseStartCue', () => {
  it('does not throw when audio context support is unavailable', () => {
    const originalWindow = (globalThis as { window?: unknown }).window;
    (globalThis as { window: { AudioContext?: typeof AudioContext } }).window = {};

    expect(() => playExerciseStartCue()).not.toThrow();

    if (originalWindow === undefined) {
      // @ts-expect-error deleting testing shim
      delete globalThis.window;
    } else {
      (globalThis as { window: unknown }).window = originalWindow;
    }
  });

  it('creates and closes an audio context when support is available', () => {
    const close = vi.fn(async () => undefined);
    const gainNode = {
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    };
    const oscillator = {
      type: 'sine',
      frequency: { value: 0 },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
    const mockContext = {
      currentTime: 1,
      destination: {},
      createGain: vi.fn(() => gainNode),
      createOscillator: vi.fn(() => oscillator),
      close,
    };
    const AudioContextMock = vi.fn(() => mockContext) as unknown as typeof AudioContext;
    const originalWindow = (globalThis as { window?: unknown }).window;
    (globalThis as { window: { AudioContext: typeof AudioContext; setTimeout: typeof setTimeout } }).window = {
      AudioContext: AudioContextMock,
      setTimeout,
    };

    playExerciseStartCue();

    expect(AudioContextMock).toHaveBeenCalledTimes(1);
    expect(mockContext.createOscillator).toHaveBeenCalledTimes(3);
    expect(mockContext.createGain).toHaveBeenCalledTimes(3);

    if (originalWindow === undefined) {
      // @ts-expect-error deleting testing shim
      delete globalThis.window;
    } else {
      (globalThis as { window: unknown }).window = originalWindow;
    }
  });
});
