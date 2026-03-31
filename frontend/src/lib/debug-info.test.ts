import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

import { execSync } from 'node:child_process';

import { getCurrentCommitHash, getCurrentEnvVariables } from './debug-info';

const mockedExecSync = vi.mocked(execSync);

describe('getCurrentCommitHash', () => {
  afterEach(() => {
    delete process.env.VERCEL_GIT_COMMIT_SHA;
    mockedExecSync.mockReset();
  });

  it('uses the vercel commit hash when present', () => {
    process.env.VERCEL_GIT_COMMIT_SHA = 'abc123';

    expect(getCurrentCommitHash()).toBe('abc123');
    expect(mockedExecSync).not.toHaveBeenCalled();
  });

  it('falls back to git when the env variable is absent', () => {
    mockedExecSync.mockReturnValue('deadbeef\n' as never);

    expect(getCurrentCommitHash()).toBe('deadbeef');
    expect(mockedExecSync).toHaveBeenCalledWith('git rev-parse HEAD', expect.any(Object));
  });

  it('returns unavailable when git lookup fails', () => {
    mockedExecSync.mockImplementation(() => {
      throw new Error('no git');
    });

    expect(getCurrentCommitHash()).toBe('unavailable');
  });
});

describe('getCurrentEnvVariables', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
  });

  it('sorts variables and redacts sensitive values', () => {
    process.env = {
      Z_VAR: 'z',
      API_TOKEN: 'secret-token',
      NEXT_PUBLIC_API_KEY: 'public-value',
      A_VAR: 'a',
    };

    expect(getCurrentEnvVariables()).toEqual([
      { key: 'A_VAR', value: 'a' },
      { key: 'API_TOKEN', value: '[redacted]' },
      { key: 'NEXT_PUBLIC_API_KEY', value: 'public-value' },
      { key: 'Z_VAR', value: 'z' },
    ]);
  });
});
