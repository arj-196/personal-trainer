import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

import { execSync } from 'node:child_process';

import {
  getCurrentCommitHash,
  getCurrentEnvVariables,
  getHeaderCommitId,
  isDebugEnabled,
} from './debug-info';

const mockedExecSync = vi.mocked(execSync);
const originalEnv = process.env;

describe('isDebugEnabled', () => {
  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns true for enabled values', () => {
    process.env = { ...originalEnv, DEBUG: 'True' };

    expect(isDebugEnabled()).toBe(true);
  });

  it('returns false when DEBUG is absent or disabled', () => {
    process.env = { ...originalEnv };
    delete process.env.DEBUG;
    expect(isDebugEnabled()).toBe(false);

    process.env = { ...originalEnv, DEBUG: 'false' };
    expect(isDebugEnabled()).toBe(false);
  });
});

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

describe('getHeaderCommitId', () => {
  afterEach(() => {
    delete process.env.VERCEL_GIT_COMMIT_SHA;
    mockedExecSync.mockReset();
  });

  it('returns the short commit id for the current hash', () => {
    mockedExecSync.mockReturnValue('deadbeef1234\n' as never);

    expect(getHeaderCommitId()).toBe('deadbee');
  });

  it('returns null when the current hash is unavailable', () => {
    mockedExecSync.mockImplementation(() => {
      throw new Error('no git');
    });

    expect(getHeaderCommitId()).toBeNull();
  });
});

describe('getCurrentEnvVariables', () => {
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
