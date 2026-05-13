type CueName = 'exercise-start' | 'rest-between-sets' | 'rest-between-exercises' | 'session-complete';

type CueStep = {
  frequency: number;
  offsetSeconds: number;
  durationSeconds: number;
  volume: number;
};

type AudioContextLike = AudioContext & {
  state?: string;
  resume?: () => Promise<void>;
};

const CUE_PATTERNS: Record<CueName, CueStep[]> = {
  'exercise-start': [
    { frequency: 659.25, offsetSeconds: 0, durationSeconds: 0.08, volume: 1.0 },
    { frequency: 783.99, offsetSeconds: 0.11, durationSeconds: 0.08, volume: 1.0 },
    { frequency: 987.77, offsetSeconds: 0.22, durationSeconds: 0.12, volume: 1.0 },
  ],
  'rest-between-sets': [
    { frequency: 523.25, offsetSeconds: 0, durationSeconds: 0.07, volume: 1.0 },
    { frequency: 440, offsetSeconds: 0.09, durationSeconds: 0.07, volume: 1.0 },
  ],
  'rest-between-exercises': [
    { frequency: 392, offsetSeconds: 0, durationSeconds: 0.09, volume: 1.0 },
    { frequency: 523.25, offsetSeconds: 0.12, durationSeconds: 0.1, volume: 1.0 },
    { frequency: 392, offsetSeconds: 0.27, durationSeconds: 0.11, volume: 1.0 },
  ],
  'session-complete': [
    { frequency: 523.25, offsetSeconds: 0, durationSeconds: 0.09, volume: 1.0 },
    { frequency: 659.25, offsetSeconds: 0.12, durationSeconds: 0.09, volume: 1.0 },
    { frequency: 783.99, offsetSeconds: 0.24, durationSeconds: 0.13, volume: 1.0 },
    { frequency: 1046.5, offsetSeconds: 0.4, durationSeconds: 0.18, volume: 1.0 },
  ],
};

function safeNow(context: AudioContext): number {
  return context.currentTime + 0.01;
}

function cueDurationSeconds(steps: CueStep[]): number {
  return steps.reduce((longest, step) => Math.max(longest, step.offsetSeconds + step.durationSeconds), 0);
}

function playTone(context: AudioContext, startTime: number, step: CueStep): void {
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();

  oscillator.type = 'sine';
  oscillator.frequency.value = step.frequency;

  gainNode.gain.setValueAtTime(0.0001, startTime);
  gainNode.gain.exponentialRampToValueAtTime(step.volume, startTime + 0.015);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + step.durationSeconds);

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);

  oscillator.start(startTime);
  oscillator.stop(startTime + step.durationSeconds + 0.01);
}

function getAudioContextCtor():
  | (new () => AudioContextLike)
  | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  const scopedWindow = window as Window & {
    AudioContext?: new () => AudioContextLike;
    webkitAudioContext?: new () => AudioContextLike;
  };

  return scopedWindow.AudioContext ?? scopedWindow.webkitAudioContext;
}

export async function playWorkoutCue(cueName: CueName): Promise<void> {
  const AudioContextCtor = getAudioContextCtor();
  if (!AudioContextCtor) {
    return;
  }

  let context: AudioContextLike | null = null;

  try {
    context = new AudioContextCtor();

    if (context.state === 'suspended' && context.resume) {
      await context.resume();
    }

    const start = safeNow(context);
    const steps = CUE_PATTERNS[cueName];
    for (const step of steps) {
      playTone(context, start + step.offsetSeconds, step);
    }

    const closeAtMs = Math.ceil((cueDurationSeconds(steps) + 0.35) * 1000);
    window.setTimeout(() => {
      void context?.close();
    }, closeAtMs);
  } catch {
    if (context) {
      void context.close().catch(() => undefined);
    }
  }
}

export type { CueName };
