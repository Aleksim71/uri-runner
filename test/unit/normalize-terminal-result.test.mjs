// path: test/unit/normalize-terminal-result.test.mjs

import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { normalizeTerminalResult } = require('../../src/runtime/terminal/normalize-terminal-result.cjs');

describe('normalizeTerminalResult', () => {
  it('marks exit code 0 as succeeded', () => {
    const result = normalizeTerminalResult({
      step: {
        type: 'terminal',
        command: 'npm',
        args: ['test'],
        cwd: '.',
      },
      executionResult: {
        command: 'npm',
        args: ['test'],
        exitCode: 0,
        signal: null,
        stdout: 'done',
        stderr: '',
        durationMs: 25,
        startedAt: '2026-03-23T09:00:00.000Z',
        finishedAt: '2026-03-23T09:00:00.025Z',
      },
    });

    expect(result.status).toBe('succeeded');
    expect(result.failureKind).toBeNull();
    expect(result.stdoutBytes).toBeGreaterThan(0);
  });

  it('maps non-zero exit code to failed/exit_code', () => {
    const result = normalizeTerminalResult({
      step: {
        type: 'terminal',
        command: 'npm',
        args: ['test'],
        cwd: '.',
      },
      executionResult: {
        command: 'npm',
        args: ['test'],
        exitCode: 1,
        signal: null,
        stdout: '',
        stderr: 'boom',
        durationMs: 25,
      },
    });

    expect(result.status).toBe('failed');
    expect(result.failureKind).toBe('exit_code');
    expect(result.summary).toContain('exit code 1');
  });

  it('maps spawn errors to failed/spawn_error', () => {
    const result = normalizeTerminalResult({
      step: {
        type: 'terminal',
        command: 'missing',
        args: [],
        cwd: '.',
      },
      executionResult: {
        command: 'missing',
        args: [],
        exitCode: null,
        signal: null,
        stdout: '',
        stderr: '',
        durationMs: 0,
        spawnError: {
          name: 'Error',
          message: 'spawn ENOENT',
          code: 'ENOENT',
        },
      },
    });

    expect(result.status).toBe('failed');
    expect(result.failureKind).toBe('spawn_error');
  });
});
