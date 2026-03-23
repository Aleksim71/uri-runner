'use strict';

const { beforeEach, describe, expect, it, vi } = require('vitest');

const runBrowserCommand = vi.fn();

vi.mock('../../src/commands/browser.cjs', () => ({
  runBrowserCommand,
}));

describe('browser cli router', () => {
  beforeEach(() => {
    runBrowserCommand.mockReset();
    runBrowserCommand.mockResolvedValue({ ok: true });
  });

  it('routes args', async () => {
    const { main } = require('../../src/cli/index.cjs');

    await main(['browser','--host','127.0.0.1','--port','9222','--json']);

    expect(runBrowserCommand).toHaveBeenCalled();
  });
});
