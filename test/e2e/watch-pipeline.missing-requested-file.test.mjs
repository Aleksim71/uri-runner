// path: test/e2e/watch-pipeline.missing-requested-file.test.mjs

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createTempWatcherEnv } from './helpers/watch-test-env.mjs';
import { createZipFromEntries } from './helpers/inbox-zip-builder.mjs';
import { extractZip } from './helpers/zip-assertions.mjs';
import { runWatcherOnce } from './helpers/watcher-runner.mjs';
import {
  buildValidInboxEntries,
  findSingleOutboxZip,
  getReportedMissingPaths,
  getReportedSuccess,
  readOutboxReport,
} from './helpers/watch-contract-adapter.mjs';

async function writePartialFixtures(fixturesDir) {
  const nestedDir = path.join(fixturesDir, 'nested');
  await mkdir(nestedDir, { recursive: true });

  const alphaPath = path.join(fixturesDir, 'alpha.txt');
  const bravoPath = path.join(nestedDir, 'bravo.txt');
  const missingPath = path.join(fixturesDir, 'missing.txt');

  await writeFile(alphaPath, 'ALPHA_OK\n', 'utf8');
  await writeFile(bravoPath, 'BRAVO_OK\n', 'utf8');

  return {
    requestedFiles: [
      {
        sourcePath: alphaPath,
        outputPath: 'provided/alpha.txt',
      },
      {
        sourcePath: bravoPath,
        outputPath: 'provided/nested/bravo.txt',
      },
      {
        sourcePath: missingPath,
        outputPath: 'provided/missing.txt',
      },
    ],
    missingPath,
  };
}

describe('watch pipeline missing requested file', () => {
  it('marks the run as failed when one requested file is absent', async () => {
    const env = await createTempWatcherEnv();

    try {
      const { requestedFiles, missingPath } = await writePartialFixtures(env.fixturesDir);
      const inboxZipPath = path.join(env.sourceDir, 'inbox.zip');

      await createZipFromEntries({
        zipPath: inboxZipPath,
        entries: buildValidInboxEntries({ requestedFiles }),
      });

      const run = await runWatcherOnce({
        cwd: env.projectDir,
        configPath: env.watchConfigPath,
      });

      expect(run.exitCode).toBe(0);

      let outboxZipPath = null;

      try {
        outboxZipPath = await findSingleOutboxZip({
          outboxDir: env.outboxDir,
          processedDir: env.processedDir,
        });
      } catch {
        outboxZipPath = null;
      }

      if (outboxZipPath) {
        const extractedOutboxDir = path.join(env.extractDir, 'outbox-missing');
        await extractZip(outboxZipPath, extractedOutboxDir);

        const report = await readOutboxReport(extractedOutboxDir);
        expect(getReportedSuccess(report)).toBe(false);
        expect(getReportedMissingPaths(report)).toContain(missingPath);
      } else {
        expect(outboxZipPath).toBeNull();
      }

      const secondRun = await runWatcherOnce({
        cwd: env.projectDir,
        configPath: env.watchConfigPath,
      });

      expect(secondRun.exitCode).toBe(0);
      expect(secondRun.stdout).toMatch(/no inbox\.zip found/i);
    } finally {
      await env.cleanup();
    }
  });
});
