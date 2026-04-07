// path: test/real/helpers/run-uri-real-case.mjs
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createTempWatcherEnv } from '../../e2e/helpers/watch-test-env.mjs';
import { runWatcherOnce } from '../../e2e/helpers/watcher-runner.mjs';
import { normalizeCurrentOutbox } from './normalize-current-outbox.mjs';

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function copyDirRecursive(srcDir, destDir) {
  await fs.mkdir(destDir, { recursive: true });
  const entries = await fs.readdir(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      await copyDirRecursive(srcPath, destPath);
      continue;
    }

    if (entry.isFile()) {
      await fs.mkdir(path.dirname(destPath), { recursive: true });
      await fs.copyFile(srcPath, destPath);
    }
  }
}

async function runCommand(command, args, options = {}) {
  const child = spawn(command, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });

  let stdout = '';
  let stderr = '';

  child.stdout.on('data', (chunk) => {
    stdout += String(chunk);
  });

  child.stderr.on('data', (chunk) => {
    stderr += String(chunk);
  });

  const exitCode = await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code) => resolve(code ?? -1));
  });

  if (exitCode !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed: ${stderr || stdout || 'unknown error'}`);
  }

  return { exitCode, stdout, stderr };
}

async function zipDir(sourceDir, zipPath) {
  await fs.rm(zipPath, { force: true });
  await fs.mkdir(path.dirname(zipPath), { recursive: true });
  await runCommand('zip', ['-rDq', zipPath, '.'], { cwd: sourceDir });
}

async function unzipFile(zipPath, destDir) {
  await fs.rm(destDir, { recursive: true, force: true });
  await fs.mkdir(destDir, { recursive: true });
  await runCommand('unzip', ['-o', zipPath, '-d', destDir]);
}

async function patchWatchConfigDownloads(configPath, downloadsDir) {
  const raw = await fs.readFile(configPath, 'utf8');
  const config = JSON.parse(raw);

  config.downloads = downloadsDir;
  config.downloadsDir = downloadsDir;
  config.source = downloadsDir;
  config.sourceDir = downloadsDir;

  await fs.writeFile(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
}

async function writeProjectsConfig(configDir, { repoRoot, outboxDir }) {
  const yaml = [
    'version: 1',
    'projects:',
    '  uri-runner-next:',
    `    cwd: ${JSON.stringify(repoRoot)}`,
    `    outboxDir: ${JSON.stringify(outboxDir)}`,
    '  uri-runner:',
    `    cwd: ${JSON.stringify(repoRoot)}`,
    `    outboxDir: ${JSON.stringify(outboxDir)}`,
    '',
  ].join('\n');

  await fs.mkdir(configDir, { recursive: true });
  await fs.writeFile(path.join(configDir, 'projects.yaml'), yaml, 'utf8');
}

async function prepareInboxZip({ caseDir, inboxZipPath, workspaceDir }) {
  const inboxSourceDir = path.join(caseDir, 'INBOX');
  const stagingDir = await fs.mkdtemp(path.join(os.tmpdir(), 'uri-real-inbox-'));

  try {
    await copyDirRecursive(inboxSourceDir, stagingDir);

    const runbookPath = path.join(stagingDir, 'RUNBOOK.yaml');
    if (await fileExists(runbookPath)) {
      let runbookText = await fs.readFile(runbookPath, 'utf8');
      runbookText = runbookText.replaceAll('__WORKSPACE__', workspaceDir);
      runbookText = runbookText.replaceAll('/workspace/project', workspaceDir);
      await fs.writeFile(runbookPath, runbookText, 'utf8');
    }

    await zipDir(stagingDir, inboxZipPath);
  } finally {
    await fs.rm(stagingDir, { recursive: true, force: true });
  }
}

async function pickFirstExisting(paths) {
  for (const candidate of paths) {
    if (candidate && await fileExists(candidate)) {
      return candidate;
    }
  }
  return null;
}

export async function runUriRealCase({
  caseName,
  repoRoot = process.cwd(),
  timeoutMs = 30_000,
}) {
  if (!caseName || typeof caseName !== 'string') {
    throw new Error('runUriRealCase requires a non-empty "caseName".');
  }

  const caseDir = path.join(repoRoot, 'test', 'real', 'cases', caseName);
  const outboxZip = path.join(caseDir, '.tmp-outbox.zip');
  const outboxDir = path.join(caseDir, '.tmp-outbox');

  await fs.rm(outboxZip, { force: true });
  await fs.rm(outboxDir, { recursive: true, force: true });

  const env = await createTempWatcherEnv();

  try {
    await patchWatchConfigDownloads(env.watchConfigPath, env.sourceDir);
    await writeProjectsConfig(path.join(env.projectDir, 'config'), {
      repoRoot,
      outboxDir: env.outboxDir,
    });

    const inboxZipPath = path.join(env.sourceDir, 'inbox.zip');
    await prepareInboxZip({
      caseDir,
      inboxZipPath,
      workspaceDir: repoRoot,
    });

    const runResult = await runWatcherOnce({
      cwd: env.projectDir,
      configPath: env.watchConfigPath,
      timeoutMs,
    });

    const candidateZip = await pickFirstExisting([
      path.join(env.outboxDir, 'outbox.zip'),
      path.join(env.processedDir, 'outbox.zip'),
    ]);

    let normalizedOutbox = null;
    let normalizeError = null;

    try {
      if (candidateZip) {
        await fs.copyFile(candidateZip, outboxZip);
        await unzipFile(candidateZip, outboxDir);
        normalizedOutbox = await normalizeCurrentOutbox(outboxDir);
      } else {
        normalizeError = new Error('outbox zip was not created by watch --once');
      }
    } catch (error) {
      normalizeError = error;
    }

    return {
      caseName,
      caseDir,
      inboxZip: inboxZipPath,
      outboxZip,
      outboxDir,
      exitCode: runResult.exitCode,
      stdout: runResult.stdout,
      stderr: runResult.stderr,
      normalizedOutbox,
      runResult: {
        exitCode: runResult.exitCode,
        stdout: runResult.stdout,
        stderr: runResult.stderr,
        errorMessage: normalizeError ? String(normalizeError.message || normalizeError) : null,
      },
    };
  } finally {
    await env.cleanup();
  }
}
