import { logger } from '@/lib/server/logger';

type JsonSchema = Record<string, unknown>;

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_TEXT_MODEL = 'gpt-5.4-mini';
const DEFAULT_TRANSCRIPTION_MODEL = 'gpt-4o-mini-transcribe';

export class RecipeAiError extends Error {}

function apiKey(): string {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    throw new RecipeAiError('OPENAI_API_KEY is not configured.');
  }
  return key;
}

function baseUrl(): string {
  return (process.env.OPENAI_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

function textModel(): string {
  return process.env.OPENAI_RECIPE_MODEL?.trim() || DEFAULT_TEXT_MODEL;
}

function transcriptionModel(): string {
  return process.env.OPENAI_TRANSCRIPTION_MODEL?.trim() || DEFAULT_TRANSCRIPTION_MODEL;
}

export async function chatJson<T extends Record<string, unknown>>(
  systemPrompt: string,
  userPrompt: string,
  schema: JsonSchema
): Promise<T> {
  logger.info('Sending recipe JSON request to OpenAI', { model: textModel() });
  const response = await fetch(`${baseUrl()}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: textModel(),
      temperature: 0.2,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'jeff_the_cook',
          strict: true,
          schema,
        },
      },
    }),
  });

  if (!response.ok) {
    throw new RecipeAiError(`OpenAI request failed with HTTP ${response.status} ${response.statusText}`);
  }

  const payload = await response.json() as {
    choices?: Array<{
      message?: {
        refusal?: string;
        content?: string | Array<{ type?: string; text?: string }>;
      };
    }>;
  };

  const message = payload.choices?.[0]?.message;
  if (!message) {
    throw new RecipeAiError('OpenAI response did not contain a message.');
  }
  if (message.refusal) {
    throw new RecipeAiError(`OpenAI refused the recipe request: ${message.refusal}`);
  }

  const textContent = typeof message.content === 'string'
    ? message.content
    : message.content?.find((item) => item.type === 'text')?.text;
  if (!textContent) {
    throw new RecipeAiError('OpenAI response did not contain structured JSON.');
  }

  try {
    return JSON.parse(textContent) as T;
  } catch {
    throw new RecipeAiError('OpenAI returned invalid JSON.');
  }
}

export async function transcribeAudio(audioFile: File): Promise<string> {
  logger.info('Sending recipe transcription request to OpenAI', { filename: audioFile.name, size: audioFile.size });
  const form = new FormData();
  form.set('file', audioFile);
  form.set('model', transcriptionModel());

  const response = await fetch(`${baseUrl()}/audio/transcriptions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey()}`,
    },
    body: form,
  });

  if (!response.ok) {
    throw new RecipeAiError(`OpenAI transcription failed with HTTP ${response.status}`);
  }

  const payload = await response.json() as { text?: string };
  if (!payload.text?.trim()) {
    throw new RecipeAiError('OpenAI transcription response did not contain text.');
  }

  return payload.text.trim();
}
