import { afterEach, describe, expect, it, vi } from 'vitest';

import { createLogger } from './logger';

describe('createLogger', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prefixes log lines with the module name', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const logger = createLogger('app_web.server.workspaces');

    logger.info('Saving check-in', { workspace: 'wk_test' });

    expect(info).toHaveBeenCalledWith('[app_web.server.workspaces] Saving check-in {"workspace":"wk_test"}');
  });

  it('keeps feature modules separate', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const logger = createLogger('app_web.recipes.service');

    logger.warn('Recipe repair did not fully validate');

    expect(warn).toHaveBeenCalledWith('[app_web.recipes.service] Recipe repair did not fully validate');
  });
});
