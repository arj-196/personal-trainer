import { execSync } from 'node:child_process';

export type DebugEnvVar = {
  key: string;
  value: string;
};

const REDACTED = '[redacted]';
const SECRET_KEY_PATTERN = /(SECRET|TOKEN|PASSWORD|PRIVATE_KEY|API_KEY|ACCESS_KEY)/i;
const TRUE_VALUES = new Set(['true', '1', 'yes', 'on']);

export function isDebugEnabled(): boolean {
  const raw = process.env.DEBUG?.trim().toLowerCase();
  return raw ? TRUE_VALUES.has(raw) : false;
}

export function getCurrentCommitHash(): string {
  const fromEnv = process.env.VERCEL_GIT_COMMIT_SHA?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  try {
    return execSync('git rev-parse HEAD', {
      cwd: process.cwd(),
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return 'unavailable';
  }
}

export function getCurrentEnvVariables(): DebugEnvVar[] {
  return Object.entries(process.env)
    .filter((entry): entry is [string, string] => entry[1] !== undefined)
    .map(([key, value]) => ({
      key,
      value: shouldRedactValue(key) ? REDACTED : value,
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

function shouldRedactValue(key: string): boolean {
  return SECRET_KEY_PATTERN.test(key) && !key.startsWith('NEXT_PUBLIC_');
}
