// path: test/scenarios/terminal-flow.execution-report.test.mjs

import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { executeTerminalStep } = require('../../src/runtime/terminal/execute-terminal-step.cjs');
const { normalizeTerminalResult } = require('../../src/runtime/terminal/normalize-terminal-result.cjs');
const { writeTerminalArtifacts } = require('../../src/runtime/terminal/write-terminal-artifacts.cjs');

describe('terminal flow execution/report slice', () => {
  it('executes an approved terminal step and writes artifacts', async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), 'uri-terminal-flow-'));
    const step = {
      type: 'terminal',
      command: process.execPath,
      args: ['-e', "console.log('terminal flow ok')"],
      cwd: '.',
      shell: false,
      approval: {
        policy: 'ask',
        explanation: 'Run terminal flow scenario',
      },
    };

    const approval = { decision: 'approved' };
    expect(approval.decision).toBe('approved');

    const executionResult = await executeTerminalStep({
      step,
      projectRoot: rootDir,
      timeoutMs: 10_000,
    });

    const terminalResult = normalizeTerminalResult({ step, executionResult });
    const persistedResult = await writeTerminalArtifacts({
      terminalResult,
      artifactsDir: path.join(rootDir, 'artifacts', 'terminal'),
      relativeTo: rootDir,
    });

    const savedJson = JSON.parse(
      await readFile(path.join(rootDir, persistedResult.resultPath), 'utf8'),
    );

    expect(terminalResult.status).toBe('succeeded');
    expect(savedJson.type).toBe('terminal');
    expect(savedJson.stdoutPath).toBe('artifacts/terminal/stdout.txt');
    expect(persistedResult.stdoutPath).toBe('artifacts/terminal/stdout.txt');
  });

  it('keeps a failed terminal execution as a step result instead of throwing', async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), 'uri-terminal-flow-'));
    const step = {
      type: 'terminal',
      command: process.execPath,
      args: ['-e', 'process.exit(1)'],
      cwd: '.',
      shell: false,
      approval: {
        policy: 'ask',
        explanation: 'Run failing terminal flow scenario',
      },
    };

    const executionResult = await executeTerminalStep({
      step,
      projectRoot: rootDir,
      timeoutMs: 10_000,
    });

    const terminalResult = normalizeTerminalResult({ step, executionResult });

    expect(terminalResult.status).toBe('failed');
    expect(terminalResult.failureKind).toBe('exit_code');
  });
});
