import { beforeEach, describe, expect, it } from 'vitest';

import { createSessionToken, validateLogin, verifySessionToken } from './auth';

describe('auth helpers', () => {
  beforeEach(() => {
    process.env.APP_USERNAME = 'coach';
    process.env.APP_PASSWORD = 'secret';
    process.env.APP_SESSION_SECRET = 'super-secret';
  });

  it('validates the configured login credentials', async () => {
    await expect(validateLogin('coach', 'secret')).resolves.toBe(true);
    await expect(validateLogin('coach', 'wrong')).resolves.toBe(false);
  });

  it('creates and verifies signed session tokens', async () => {
    const token = await createSessionToken('coach');
    await expect(verifySessionToken(token)).resolves.toBe(true);
    await expect(verifySessionToken(`${token}tampered`)).resolves.toBe(false);
  });
});
