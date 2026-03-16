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
 * Fallback source:
 *   runtime/traces/*.trace.json
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
  const traceDir = resolveTraceDir(options.traceDir);

  if (!fs.existsSync(traceDir)) {
    return [];
  }

  const files = await fs.promises.readdir(traceDir);

  const traceFiles = files
    .filter((fileName) => fileName.endsWith('.trace.json'))
    .map((fileName) => path.join(traceDir, fileName));

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
        traceRelPath: path.relative(resolveProjectRoot(options.projectRoot), file).split(path.sep).join('/'),
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

function resolveTraceDir(traceDir) {
  if (typeof traceDir === 'string' && traceDir.trim() !== '') {
    return path.resolve(traceDir);
  }

  return path.resolve(__dirname, '../../runtime/traces');
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
