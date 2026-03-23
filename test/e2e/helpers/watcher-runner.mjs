// path: test/e2e/helpers/watcher-runner.mjs

import { access, readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

async function pathExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function getDefaultRepoRoot() {
  const currentFilePath = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(currentFilePath), '..', '..', '..');
}

async function readPackageJson(repoRoot) {
  const packageJsonPath = path.join(repoRoot, 'package.json');
  if (!(await pathExists(packageJsonPath))) {
    return null;
  }

  const raw = await readFile(packageJsonPath, 'utf8');
  return JSON.parse(raw);
}

function getBinEntryFromPackageJson(packageJson) {
  if (!packageJson?.bin) {
    return null;
  }

  if (typeof packageJson.bin === 'string') {
    return packageJson.bin;
  }

  if (typeof packageJson.bin === 'object') {
    if (typeof packageJson.bin.uri === 'string') {
      return packageJson.bin.uri;
    }

    const firstValue = Object.values(packageJson.bin).find((value) => typeof value === 'string');
    return firstValue ?? null;
  }

  return null;
}

async function resolveCommand(configPath, repoRoot) {
  if (process.env.URI_WATCH_CMD) {
    return {
      cwd: repoRoot,
      command: 'bash',
      args: ['-lc', process.env.URI_WATCH_CMD.replaceAll('{config}', configPath)],
    };
  }

  const packageJson = await readPackageJson(repoRoot);
  const packageBinEntry = getBinEntryFromPackageJson(packageJson);

  const candidates = [
    packageBinEntry
      ? {
          command: 'node',
          args: [packageBinEntry, 'watch', '--once', '--config', configPath],
          check: path.join(repoRoot, packageBinEntry),
        }
      : null,
    {
      command: 'node',
      args: ['bin/uri', 'watch', '--once', '--config', configPath],
      check: path.join(repoRoot, 'bin', 'uri'),
    },
    {
      command: 'node',
      args: ['bin/uri.cjs', 'watch', '--once', '--config', configPath],
      check: path.join(repoRoot, 'bin', 'uri.cjs'),
    },
    {
      command: 'node',
      args: ['src/cli.cjs', 'watch', '--once', '--config', configPath],
      check: path.join(repoRoot, 'src', 'cli.cjs'),
    },
    {
      command: 'npm',
      args: ['exec', '--', 'uri', 'watch', '--once', '--config', configPath],
      check: path.join(repoRoot, 'package.json'),
    },
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (await pathExists(candidate.check)) {
      return {
        cwd: repoRoot,
        command: candidate.command,
        args: candidate.args,
      };
    }
  }

  throw new Error(
    [
      'Unable to resolve watcher command automatically.',
      `repoRoot: ${repoRoot}`,
      'Looked for package bin entry, common local CLI entrypoints, and npm exec fallback.',
      'You can still override the command explicitly:',
      '  URI_WATCH_CMD="uri watch --once --config {config}" npm test',
    ].join('\n'),
  );
}

export async function runWatcherOnce({ cwd, configPath, env = {}, repoRoot = getDefaultRepoRoot() }) {
  const resolved = await resolveCommand(configPath, repoRoot);

  return new Promise((resolve, reject) => {
    const child = spawn(resolved.command, resolved.args, {
      cwd: resolved.cwd,
      env: {
        ...process.env,
        ...env,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });

    child.on('error', reject);
    child.on('close', (exitCode) => {
      resolve({
        exitCode,
        stdout,
        stderr,
        command: resolved.command,
        args: resolved.args,
        cwd: resolved.cwd,
        requestedCwd: cwd,
        repoRoot,
      });
    });
  });
}
