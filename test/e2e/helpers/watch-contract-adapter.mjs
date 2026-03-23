// path: test/e2e/helpers/watch-contract-adapter.mjs

import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { readJson } from './zip-assertions.mjs';

export function buildValidInboxEntries({ requestedFiles }) {
  return [
    {
      path: 'request/requested-files.json',
      kind: 'json',
      value: {
        requestedFiles,
      },
    },
    {
      path: 'request/metadata.json',
      kind: 'json',
      value: {
        source: 'e2e-watch-pipeline',
        createdBy: 'vitest',
      },
    },
  ];
}

async function collectZipFilesRecursive(rootDir, results) {
  let entries;
  try {
    entries = await readdir(rootDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const entryPath = path.join(rootDir, entry.name);

    if (entry.isDirectory()) {
      await collectZipFilesRecursive(entryPath, results);
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.zip')) {
      results.push(entryPath);
    }
  }
}

export async function listZipCandidates({ rootDirs = [], excludePaths = [] } = {}) {
  const collected = [];
  for (const rootDir of rootDirs) {
    await collectZipFilesRecursive(rootDir, collected);
  }

  const excludeSet = new Set(excludePaths.map((item) => path.resolve(item)));

  return [...new Set(collected.map((item) => path.resolve(item)))].filter(
    (item) => !excludeSet.has(item),
  );
}

export async function readOutboxReport(extractedOutboxDir) {
  const candidates = [
    path.join(extractedOutboxDir, 'outbox.json'),
    path.join(extractedOutboxDir, 'report', 'outbox.json'),
    path.join(extractedOutboxDir, 'result', 'outbox.json'),
  ];

  let lastError;
  for (const candidate of candidates) {
    try {
      return await readJson(candidate);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error('Unable to locate outbox report.');
}

export function getReportedSuccess(report) {
  if (typeof report?.success === 'boolean') {
    return report.success;
  }

  if (typeof report?.goalReached === 'boolean') {
    return report.goalReached;
  }

  if (typeof report?.status === 'string') {
    return ['ok', 'success', 'completed'].includes(report.status.toLowerCase());
  }

  throw new Error('Unable to infer success flag from outbox report. Align watch-contract-adapter.mjs.');
}

export function getReportedMissingPaths(report) {
  if (Array.isArray(report?.missingFiles)) {
    return report.missingFiles;
  }

  if (Array.isArray(report?.missing_paths)) {
    return report.missing_paths;
  }

  if (Array.isArray(report?.errors)) {
    return report.errors
      .filter((item) => typeof item?.path === 'string')
      .map((item) => item.path);
  }

  return [];
}

export function getProvidedArtifactRoot(extractedOutboxDir) {
  const candidates = [
    path.join(extractedOutboxDir, 'provided'),
    path.join(extractedOutboxDir, 'artifacts'),
    extractedOutboxDir,
  ];

  return candidates[0];
}
