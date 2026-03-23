// path: test/e2e/helpers/watch-test-env.mjs

import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

async function ensureDir(dirPath) {
  await mkdir(dirPath, { recursive: true });
}

export async function createTempWatcherEnv(options = {}) {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'uri-watch-e2e-'));

  const sourceDir = path.join(rootDir, 'source');
  const projectDir = path.join(rootDir, 'project');
  const inboxDir = path.join(projectDir, 'Inbox');
  const processedDir = path.join(projectDir, 'runtime', 'watch', 'processed');
  const outboxDir = path.join(projectDir, 'Outbox');
  const fixturesDir = path.join(rootDir, 'fixtures', 'requested');
  const extractDir = path.join(rootDir, 'extract');
  const configDir = path.join(projectDir, 'config');
  const logsDir = path.join(rootDir, 'logs');

  await Promise.all([
    ensureDir(sourceDir),
    ensureDir(inboxDir),
    ensureDir(processedDir),
    ensureDir(outboxDir),
    ensureDir(fixturesDir),
    ensureDir(extractDir),
    ensureDir(configDir),
    ensureDir(logsDir),
  ]);

  const watchConfigPath = path.join(configDir, 'watch.json');

  const watchConfig = {
    transport: 'project-owned',
    source: sourceDir,
    inbox: inboxDir,
    processed: processedDir,
    outbox: outboxDir,
    ...options.watchConfigOverrides,
  };

  await writeFile(watchConfigPath, `${JSON.stringify(watchConfig, null, 2)}\n`, 'utf8');

  async function cleanup() {
    await rm(rootDir, { recursive: true, force: true });
  }

  return {
    rootDir,
    sourceDir,
    projectDir,
    inboxDir,
    processedDir,
    outboxDir,
    fixturesDir,
    extractDir,
    configDir,
    logsDir,
    watchConfigPath,
    watchConfig,
    cleanup,
  };
}
