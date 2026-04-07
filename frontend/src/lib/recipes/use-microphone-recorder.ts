'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { normalizeAudioMimeType } from './audio-format';

type UseMicrophoneRecorderOptions = {
  onRecordingComplete?: (audioBlob: Blob) => Promise<void> | void;
  onRecordingStart?: () => void;
};

type UseMicrophoneRecorderResult = {
  error: string | null;
  isRecording: boolean;
  recordingBlob: Blob | null;
  recordingUrl: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
};

export function useMicrophoneRecorder({
  onRecordingComplete,
  onRecordingStart,
}: UseMicrophoneRecorderOptions = {}): UseMicrophoneRecorderResult {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const objectUrlRef = useRef<string | null>(null);

  const stopActiveStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const setLatestRecording = useCallback((blob: Blob) => {
    setRecordingBlob(blob);

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    const nextUrl = URL.createObjectURL(blob);
    objectUrlRef.current = nextUrl;
    setRecordingUrl(nextUrl);
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    if (isRecording) {
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('This browser does not support microphone capture.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);

      streamRef.current = stream;
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        stopActiveStream();
        setIsRecording(false);

        const chunkMimeType = chunksRef.current.find((chunk) => chunk.type)?.type;
        const resolvedMimeType = normalizeAudioMimeType(chunkMimeType || recorder.mimeType);
        const audioBlob = new Blob(chunksRef.current, { type: resolvedMimeType });
        setLatestRecording(audioBlob);
        chunksRef.current = [];
        mediaRecorderRef.current = null;

        if (onRecordingComplete) {
          Promise.resolve(onRecordingComplete(audioBlob)).catch((callbackError) => {
            setError(callbackError instanceof Error ? callbackError.message : 'Could not process recording.');
          });
        }
      };

      recorder.onerror = () => {
        setError('Microphone recording failed.');
      };

      recorder.start();
      setIsRecording(true);
      onRecordingStart?.();
    } catch (startError) {
      stopActiveStream();
      setIsRecording(false);
      setError(startError instanceof Error ? startError.message : 'Could not start microphone.');
    }
  }, [isRecording, onRecordingComplete, onRecordingStart, setLatestRecording, stopActiveStream]);

  useEffect(() => {
    return () => {
      stopActiveStream();
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [stopActiveStream]);

  return {
    error,
    isRecording,
    recordingBlob,
    recordingUrl,
    startRecording,
    stopRecording,
  };
}
