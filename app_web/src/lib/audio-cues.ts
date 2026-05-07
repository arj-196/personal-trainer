const DEFAULT_CUE_VOLUME = 0.03;

function safeNow(context: AudioContext): number {
  return context.currentTime + 0.01;
}

function playTone(
  context: AudioContext,
  frequency: number,
  startTime: number,
  durationSeconds: number
): void {
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();

  oscillator.type = 'sine';
  oscillator.frequency.value = frequency;

  gainNode.gain.setValueAtTime(0.0001, startTime);
  gainNode.gain.exponentialRampToValueAtTime(DEFAULT_CUE_VOLUME, startTime + 0.015);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + durationSeconds);

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);

  oscillator.start(startTime);
  oscillator.stop(startTime + durationSeconds + 0.01);
}

export function playExerciseStartCue(): void {
  if (typeof window === 'undefined') {
    return;
  }

  const scopedWindow = window as Window & {
    webkitAudioContext?: typeof AudioContext;
  };
  const AudioContextCtor = scopedWindow.AudioContext ?? scopedWindow.webkitAudioContext;
  if (!AudioContextCtor) {
    return;
  }

  try {
    const context = new AudioContextCtor();
    const start = safeNow(context);

    // Web Audio avoids media-session side effects from HTML media playback.
    playTone(context, 659.25, start, 0.08);
    playTone(context, 783.99, start + 0.1, 0.08);
    playTone(context, 987.77, start + 0.2, 0.11);

    const closeAtMs = 700;
    window.setTimeout(() => {
      void context.close();
    }, closeAtMs);
  } catch {
    // Ignore cue errors to keep workout flow uninterrupted.
  }
}
