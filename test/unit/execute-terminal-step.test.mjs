// path: test/unit/execute-terminal-step.test.mjs

import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { executeTerminalStep } = require('../../src/runtime/terminal/execute-terminal-step.cjs');

describe('executeTerminalStep', () => {
  it('captures stdout and exit code for a successful command', async () => {
    const result = await executeTerminalStep({
      step: {
        type: 'terminal',
        command: process.execPath,
        args: ['-e', "console.log('ok from terminal step')"],
        cwd: '.',
        shell: false,
      },
      projectRoot: process.cwd(),
    });

    expect(result.exitCode).toBe(0);
    expect(result.signal).toBeNull();
    expect(result.spawnError).toBeNull();
    expect(result.stdout).toContain('ok from terminal step');
  });

  it('returns a serialized spawn error instead of throwing', async () => {
    const result = await executeTerminalStep({
      step: {
        type: 'terminal',
        command: 'definitely-not-a-real-command-12345',
        args: [],
        cwd: '.',
        shell: false,
      },
      projectRoot: process.cwd(),
    });

    expect(result.exitCode).toBeNull();
    expect(result.spawnError).toBeTruthy();
    expect(result.spawnError.message.length).toBeGreaterThan(0);
  });

  it('marks a command as timed out when timeoutMs is exceeded', async () => {
    const result = await executeTerminalStep({
      step: {
        type: 'terminal',
        command: process.execPath,
        args: ['-e', 'setTimeout(() => {}, 1000)'],
        cwd: '.',
        shell: false,
      },
      projectRoot: process.cwd(),
      timeoutMs: 50,
    });

    expect(result.timedOut).toBe(true);
  });
});
