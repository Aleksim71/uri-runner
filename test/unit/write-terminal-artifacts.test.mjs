// path: test/unit/write-terminal-artifacts.test.mjs

import { mkdtemp, readFile, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { writeTerminalArtifacts } = require('../../src/runtime/terminal/write-terminal-artifacts.cjs');

describe('writeTerminalArtifacts', () => {
  it('writes result json and output streams', async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), 'uri-terminal-artifacts-'));
    const artifactsDir = path.join(rootDir, 'artifacts', 'terminal');

    const result = await writeTerminalArtifacts({
      terminalResult: {
        type: 'terminal',
        status: 'failed',
        command: 'npm',
        args: ['test'],
        cwd: '.',
        shell: false,
        exitCode: 1,
        signal: null,
        durationMs: 10,
        failureKind: 'exit_code',
        summary: 'Command failed with exit code 1',
        startedAt: '2026-03-23T09:00:00.000Z',
        finishedAt: '2026-03-23T09:00:00.010Z',
        stdout: 'stdout',
        stderr: 'stderr',
        stdoutBytes: 6,
        stderrBytes: 6,
      },
      artifactsDir,
      relativeTo: rootDir,
    });

    const jsonPath = path.join(rootDir, result.resultPath);
    const stdoutPath = path.join(rootDir, result.stdoutPath);
    const stderrPath = path.join(rootDir, result.stderrPath);

    expect((await stat(jsonPath)).isFile()).toBe(true);
    expect((await stat(stdoutPath)).isFile()).toBe(true);
    expect((await stat(stderrPath)).isFile()).toBe(true);

    const publicJson = JSON.parse(await readFile(jsonPath, 'utf8'));
    expect(publicJson.stdoutPath).toBe('artifacts/terminal/stdout.txt');
    expect(publicJson.stderrPath).toBe('artifacts/terminal/stderr.txt');
    expect(publicJson.stdout).toBeUndefined();
    expect(publicJson.stderr).toBeUndefined();
  });

  it('skips empty stdout/stderr files', async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), 'uri-terminal-artifacts-'));
    const artifactsDir = path.join(rootDir, 'artifacts', 'terminal');

    const result = await writeTerminalArtifacts({
      terminalResult: {
        type: 'terminal',
        status: 'succeeded',
        command: 'npm',
        args: ['test'],
        cwd: '.',
        shell: false,
        exitCode: 0,
        signal: null,
        durationMs: 10,
        failureKind: null,
        summary: 'Command completed with exit code 0',
        startedAt: '2026-03-23T09:00:00.000Z',
        finishedAt: '2026-03-23T09:00:00.010Z',
        stdout: '',
        stderr: '',
        stdoutBytes: 0,
        stderrBytes: 0,
      },
      artifactsDir,
      relativeTo: rootDir,
    });

    expect(result.stdoutPath).toBeNull();
    expect(result.stderrPath).toBeNull();
  });
});
