// path: test/e2e/helpers/zip-assertions.mjs

import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { expect } from 'vitest';

function runPython(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('python3', args, {
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
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(new Error(`python3 exited with code ${code}\n${stderr}`));
    });
  });
}

export async function extractZip(zipPath, targetDir) {
  await mkdir(targetDir, { recursive: true });

  const script = `
import sys
import zipfile

zip_path = sys.argv[1]
target_dir = sys.argv[2]

with zipfile.ZipFile(zip_path, 'r') as archive:
    archive.extractall(target_dir)
`;

  await runPython(['-c', script, zipPath, targetDir]);
}

export async function readJson(filePath) {
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

export async function assertFileText(filePath, expected) {
  const actual = await readFile(filePath, 'utf8');
  expect(actual).toBe(expected);
}

export async function assertFileJson(filePath, expectedObject) {
  const actual = await readJson(filePath);
  expect(actual).toEqual(expectedObject);
}

export async function assertFileExists(rootDir, relativePath) {
  const filePath = path.join(rootDir, relativePath);
  await readFile(filePath);
}

export async function assertZipContainsPaths(extractedDir, expectedPaths) {
  for (const relativePath of expectedPaths) {
    await assertFileExists(extractedDir, relativePath);
  }
}
