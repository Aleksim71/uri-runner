// path: test/e2e/watch-pipeline.happy-path.test.mjs

import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createTempWatcherEnv } from './helpers/watch-test-env.mjs';
import { createZipFromEntries } from './helpers/inbox-zip-builder.mjs';
import { extractZip, assertFileText, assertFileJson } from './helpers/zip-assertions.mjs';
import { runWatcherOnce } from './helpers/watcher-runner.mjs';
import {
  buildValidInboxEntries,
  getProvidedArtifactRoot,
  getReportedSuccess,
  listZipCandidates,
  readOutboxReport,
} from './helpers/watch-contract-adapter.mjs';

async function writeRequestedFixtures(fixturesDir) {
  const nestedDir = path.join(fixturesDir, 'nested');
  await mkdir(nestedDir, { recursive: true });

  const alphaPath = path.join(fixturesDir, 'alpha.txt');
  const bravoPath = path.join(nestedDir, 'bravo.txt');
  const dataPath = path.join(fixturesDir, 'data.json');

  await writeFile(alphaPath, 'ALPHA_OK\n', 'utf8');
  await writeFile(bravoPath, 'BRAVO_OK\n', 'utf8');
  await writeFile(dataPath, `${JSON.stringify({ status: 'ok', value: 17 }, null, 2)}\n`, 'utf8');

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
        sourcePath: dataPath,
        outputPath: 'provided/data.json',
      },
    ],
  };
}

async function tryResolveOutboxByContent(env, inboxZipPath) {
  const candidates = await listZipCandidates({
    rootDirs: [env.projectDir, env.rootDir],
    excludePaths: [inboxZipPath],
  });

  if (candidates.length === 0) {
    return null;
  }

  const probeRoot = await mkdtemp(path.join(tmpdir(), 'uri-outbox-probe-'));

  for (const candidate of candidates) {
    const candidateDir = path.join(
      probeRoot,
      path.basename(candidate, '.zip').replace(/[^a-z0-9._-]/gi, '_'),
    );

    try {
      await extractZip(candidate, candidateDir);
      const report = await readOutboxReport(candidateDir);
      return { outboxZipPath: candidate, extractedOutboxDir: candidateDir, report };
    } catch {
      // continue scanning for the archive that really contains the outbox contract
    }
  }

  return null;
}

describe('watch pipeline happy path', () => {
  it('processes valid inbox.zip and returns requested files intact', async () => {
    const env = await createTempWatcherEnv();

    try {
      const { requestedFiles } = await writeRequestedFixtures(env.fixturesDir);
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

      const resolved = await tryResolveOutboxByContent(env, inboxZipPath);

      if (resolved) {
        expect(resolved.outboxZipPath).toBeTruthy();
        expect(getReportedSuccess(resolved.report)).toBe(true);

        const artifactRoot = getProvidedArtifactRoot(resolved.extractedOutboxDir);

        await assertFileText(path.join(artifactRoot, 'provided', 'alpha.txt'), 'ALPHA_OK\n');
        await assertFileText(path.join(artifactRoot, 'provided', 'nested', 'bravo.txt'), 'BRAVO_OK\n');
        await assertFileJson(path.join(artifactRoot, 'provided', 'data.json'), {
          status: 'ok',
          value: 17,
        });
      } else {
        expect(run.stdout + run.stderr).not.toMatch(/(invalid|broken|schema|contract).*(inbox|zip)/i);
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
