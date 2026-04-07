const DEFAULT_AUDIO_MIME_TYPE = 'audio/webm';
const DEFAULT_AUDIO_EXTENSION = 'webm';

function normalizeMimeInput(value: string): string {
  return value.trim().toLowerCase().split(';')[0];
}

export function normalizeAudioMimeType(value: string | null | undefined): string {
  if (!value?.trim()) {
    return DEFAULT_AUDIO_MIME_TYPE;
  }

  const normalized = normalizeMimeInput(value);
  if (normalized === 'audio/mp4' || normalized === 'audio/m4a' || normalized === 'audio/x-m4a') {
    return 'audio/mp4';
  }
  if (normalized === 'audio/webm') {
    return 'audio/webm';
  }
  if (normalized === 'audio/wav' || normalized === 'audio/x-wav') {
    return 'audio/wav';
  }
  if (normalized === 'audio/mpeg' || normalized === 'audio/mp3' || normalized === 'audio/x-mp3') {
    return 'audio/mpeg';
  }
  if (normalized === 'audio/ogg' || normalized === 'audio/opus') {
    return 'audio/ogg';
  }

  return normalized.startsWith('audio/') ? normalized : DEFAULT_AUDIO_MIME_TYPE;
}

export function audioFileExtensionForMimeType(value: string | null | undefined): string {
  const mimeType = normalizeAudioMimeType(value);
  if (mimeType === 'audio/mp4') return 'm4a';
  if (mimeType === 'audio/wav') return 'wav';
  if (mimeType === 'audio/mpeg') return 'mp3';
  if (mimeType === 'audio/ogg') return 'ogg';
  if (mimeType === 'audio/webm') return 'webm';
  return DEFAULT_AUDIO_EXTENSION;
}
