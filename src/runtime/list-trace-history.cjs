'use strict';

const fs = require('fs');
const path = require('path');

const {
  readHistoryIndex,
  resolveHistoryIndexPath
} = require('./history/read-history-index.cjs');

const TRACE_SCHEMA = 'uri.trace.v1';

/**
 * URI Runner
 * Trace History
 *
 * Preferred source:
 *   runtime/history/index.json
 *
 * Fallback sources:
 *   runtime/traces/*.trace.json
 *   runtime/runs/<runId>/traces/*.trace.json
 */

async function listTraceHistory(options = {}) {
  const historyIndexPath = resolveHistoryIndexPath(options.historyIndexPath);

  try {
    const { exists, index } = await readHistoryIndex({ historyIndexPath });

    if (exists && Array.isArray(index.runs) && index.runs.length) {
      return index.runs
        .slice()
        .sort(compareHistoryEntriesDesc)
        .map((run) => ({
          runId: run.runId || null,
          createdAt: run.createdAt || null,
          goal: run.goal || null,
          finalStatus: run.finalStatus || null,
          attempts: Number.isInteger(run.attempts) ? run.attempts : 1,
          steps: Number.isInteger(run.stepCount) ? run.stepCount : 0,
          traceRelPath: run.traceRelPath || null,
          outboxRelPath: run.outboxRelPath || null,
          planRelPath: run.planRelPath || null
        }));
    }
  } catch (error) {
    // Fall back to direct trace scan for backward compatibility.
  }

  return scanTraceDirectory(options);
}

async function scanTraceDirectory(options = {}) {
  const projectRoot = resolveProjectRoot(options.projectRoot);
  const traceFiles = await collectTraceFiles(options);

  const runs = [];

  for (const file of traceFiles) {
    try {
      const raw = await fs.promises.readFile(file, 'utf8');
      const trace = JSON.parse(raw);

      if (trace.schema !== TRACE_SCHEMA) {
        continue;
      }

      runs.push({
        runId: trace.runId || null,
        createdAt: trace.createdAt || null,
        goal: trace.goal || null,
        finalStatus: trace.finalStatus || null,
        attempts: Number.isInteger(trace.attempts) ? trace.attempts : 1,
        steps: Array.isArray(trace.steps) ? trace.steps.length : 0,
        traceRelPath: path.relative(projectRoot, file).split(path.sep).join('/'),
        outboxRelPath: null,
        planRelPath: null
      });
    } catch (error) {
      // Ignore broken or incompatible trace files
    }
  }

  runs.sort(compareHistoryEntriesDesc);

  return runs;
}

async function collectTraceFiles(options = {}) {
  const explicitTraceDir = resolveExplicitTraceDir(options.traceDir);

  if (explicitTraceDir) {
    return listTraceFilesInDir(explicitTraceDir);
  }

  const runtimeRoot = resolveRuntimeRoot(options.projectRoot);
  const legacyTraceDir = path.join(runtimeRoot, 'traces');
  const runsDir = path.join(runtimeRoot, 'runs');

  const files = [];

  files.push(...await listTraceFilesInDir(legacyTraceDir));
  files.push(...await listTraceFilesUnderRuns(runsDir));

  return dedupePaths(files);
}

async function listTraceFilesUnderRuns(runsDir) {
  if (!fs.existsSync(runsDir)) {
    return [];
  }

  const entries = await fs.promises.readdir(runsDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const traceDir = path.join(runsDir, entry.name, 'traces');
    files.push(...await listTraceFilesInDir(traceDir));
  }

  return files;
}

async function listTraceFilesInDir(traceDir) {
  if (!fs.existsSync(traceDir)) {
    return [];
  }

  const files = await fs.promises.readdir(traceDir);

  return files
    .filter((fileName) => fileName.endsWith('.trace.json'))
    .map((fileName) => path.join(traceDir, fileName));
}

function dedupePaths(pathsList) {
  return Array.from(new Set(pathsList.map((item) => path.resolve(item))));
}

function compareHistoryEntriesDesc(a, b) {
  const aDate = normalizeDate(a.createdAt);
  const bDate = normalizeDate(b.createdAt);

  if (aDate && bDate && aDate !== bDate) {
    return bDate.localeCompare(aDate);
  }

  if (!a.runId) return 1;
  if (!b.runId) return -1;

  return b.runId.localeCompare(a.runId);
}

function normalizeDate(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }

  return value.trim();
}

function resolveExplicitTraceDir(traceDir) {
  if (typeof traceDir === 'string' && traceDir.trim() !== '') {
    return path.resolve(traceDir);
  }

  return null;
}

function resolveRuntimeRoot(projectRoot) {
  return path.join(resolveProjectRoot(projectRoot), 'runtime');
}

function resolveProjectRoot(projectRoot) {
  if (typeof projectRoot === 'string' && projectRoot.trim() !== '') {
    return path.resolve(projectRoot);
  }

  return path.resolve(__dirname, '../..');
}

module.exports = {
  listTraceHistory
};
