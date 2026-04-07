import { describe, expect, it } from 'vitest';

import { audioFileExtensionForMimeType, normalizeAudioMimeType } from './audio-format';

describe('audio format helpers', () => {
  it('normalizes iOS mp4 mime variants to audio/mp4', () => {
    expect(normalizeAudioMimeType('audio/mp4')).toBe('audio/mp4');
    expect(normalizeAudioMimeType('audio/mp4; codecs=mp4a.40.2')).toBe('audio/mp4');
    expect(normalizeAudioMimeType('audio/x-m4a')).toBe('audio/mp4');
  });

  it('maps common audio mime types to expected extensions', () => {
    expect(audioFileExtensionForMimeType('audio/mp4')).toBe('m4a');
    expect(audioFileExtensionForMimeType('audio/webm')).toBe('webm');
    expect(audioFileExtensionForMimeType('audio/wav')).toBe('wav');
    expect(audioFileExtensionForMimeType('audio/mpeg')).toBe('mp3');
    expect(audioFileExtensionForMimeType('audio/ogg')).toBe('ogg');
  });

  it('falls back safely for unknown or missing mime types', () => {
    expect(normalizeAudioMimeType('')).toBe('audio/webm');
    expect(normalizeAudioMimeType('application/octet-stream')).toBe('audio/webm');
    expect(audioFileExtensionForMimeType('')).toBe('webm');
    expect(audioFileExtensionForMimeType(undefined)).toBe('webm');
  });
});
