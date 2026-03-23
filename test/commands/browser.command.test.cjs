'use strict';

// path: test/commands/browser.command.test.cjs

const path = require('node:path');
const { beforeEach, describe, expect, it, vi } = require('vitest');

const runBrowserDiagnostics = vi.fn();

vi.mock('../../src/runtime/browser/run-browser-diagnostics.cjs', () => ({
  runBrowserDiagnostics,
}));

describe('browser command options', () => {
  beforeEach(() => {
    runBrowserDiagnostics.mockReset();
  });

  it('normalizes browser command options for runtime', async () => {
    const { normalizeBrowserCommandOptions } = require('../../src/commands/browser.cjs');

    expect(
      normalizeBrowserCommandOptions({
        host: '127.0.0.1',
        port: '9333',
        target: 'example.com',
        artifactsDir: 'runtime/custom-browser',
        timeoutMs: '2500',
      }),
    ).toEqual({
      host: '127.0.0.1',
      port: 9333,
      target: 'example.com',
      artifactsDir: path.resolve('runtime/custom-browser'),
      timeoutMs: 2500,
    });
  });

  it('runs browser diagnostics and strips cli-only json flag from runtime options', async () => {
    const { runBrowserCommand } = require('../../src/commands/browser.cjs');
    runBrowserDiagnostics.mockResolvedValue({ ok: true });

    const stdoutWrite = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    const result = await runBrowserCommand({
      host: '127.0.0.1',
      port: '9222',
      target: 'localhost',
      artifactsDir: 'runtime/browser-artifacts',
      timeoutMs: '1500',
      json: true,
    });

    expect(result).toEqual({ ok: true });
    expect(runBrowserDiagnostics).toHaveBeenCalledWith({
      host: '127.0.0.1',
      port: 9222,
      target: 'localhost',
      artifactsDir: path.resolve('runtime/browser-artifacts'),
      timeoutMs: 1500,
    });
    expect(stdoutWrite).toHaveBeenCalled();

    stdoutWrite.mockRestore();
  });
});
