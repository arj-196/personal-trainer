import { describe, expect, it, vi } from 'vitest';

import { playWorkoutCue } from './audio-cues';

function installAudioWindow(overrides?: {
  currentTime?: number;
  state?: string;
  resumeImpl?: () => Promise<void>;
}) {
  const close = vi.fn(async () => undefined);
  const resume = vi.fn(overrides?.resumeImpl ?? (async () => undefined));
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
    currentTime: overrides?.currentTime ?? 1,
    destination: {},
    state: overrides?.state ?? 'running',
    createGain: vi.fn(() => gainNode),
    createOscillator: vi.fn(() => oscillator),
    close,
    resume,
  };
  const AudioContextMock = vi.fn(() => mockContext) as unknown as typeof AudioContext;

  vi.stubGlobal('window', {
    AudioContext: AudioContextMock,
    setTimeout,
  });

  return {
    AudioContextMock,
    close,
    gainNode,
    mockContext,
    oscillator,
    resume,
  };
}

describe('playWorkoutCue', () => {
  it('does not throw when audio context support is unavailable', async () => {
    vi.stubGlobal('window', {});

    await expect(playWorkoutCue('exercise-start')).resolves.toBeUndefined();
  });

  it('resumes suspended audio contexts before playing cues', async () => {
    const { AudioContextMock, mockContext, resume } = installAudioWindow({ state: 'suspended' });

    await playWorkoutCue('exercise-start');

    expect(AudioContextMock).toHaveBeenCalledTimes(1);
    expect(resume).toHaveBeenCalledTimes(1);
    expect(mockContext.createOscillator).toHaveBeenCalledTimes(3);
    expect(mockContext.createGain).toHaveBeenCalledTimes(3);
  });

  it('uses distinct tone counts for different workout-stage cues', async () => {
    const { mockContext } = installAudioWindow();

    await playWorkoutCue('rest-between-sets');
    await playWorkoutCue('rest-between-exercises');
    await playWorkoutCue('session-complete');

    expect(mockContext.createOscillator).toHaveBeenCalledTimes(2 + 3 + 4);
    expect(mockContext.createGain).toHaveBeenCalledTimes(2 + 3 + 4);
  });
});
