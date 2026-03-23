// path: test/e2e/watch-pipeline.invalid-contract.test.mjs

import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createTempWatcherEnv } from './helpers/watch-test-env.mjs';
import { createBrokenInboxZip } from './helpers/inbox-zip-builder.mjs';
import { runWatcherOnce } from './helpers/watcher-runner.mjs';

describe('watch pipeline invalid inbox contract', () => {
  it('does not report success when the inbox zip is structurally valid but contract-invalid', async () => {
    const env = await createTempWatcherEnv();

    try {
      const inboxZipPath = path.join(env.sourceDir, 'inbox.zip');
      await createBrokenInboxZip({
        zipPath: inboxZipPath,
        mode: 'missing-contract-file',
      });

      const run = await runWatcherOnce({
        cwd: env.projectDir,
        configPath: env.watchConfigPath,
      });

      expect(run.stdout + run.stderr).not.toMatch(/status:\s*(ok|success|completed)/i);

      const secondRun = await runWatcherOnce({
        cwd: env.projectDir,
        configPath: env.watchConfigPath,
      });

      expect(secondRun.exitCode).toBe(0);
    } finally {
      await env.cleanup();
    }
  });
});
