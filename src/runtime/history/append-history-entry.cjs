'use strict';

const path = require('path');

const {
  toHistoryEntryExtras
} = require('../finalize-run.cjs');

const {
  readHistoryIndex,
  resolveHistoryIndexPath
} = require('./read-history-index.cjs');

const {
  writeHistoryIndex
} = require('./write-history-index.cjs');

async function appendHistoryEntry(options = {}) {
  const trace = options.trace;

  if (!trace || typeof trace !== 'object') {
    throw new Error('append-history-entry: trace object is required');
  }

  const runId = normalizeString(trace.runId);

  if (!runId) {
    throw new Error('append-history-entry: trace.runId is required');
  }

  const historyIndexPath = resolveHistoryIndexPath(options.historyIndexPath);
  const { index } = await readHistoryIndex({ historyIndexPath });

  const existing = index.runs.find((run) => run.runId === runId);

  if (existing) {
    throw new Error(`append-history-entry: duplicate runId: ${runId}`);
  }

  const entry = buildHistoryEntry({
    trace,
    tracePath: options.tracePath,
    outboxPath: options.outboxPath,
    planPath: options.planPath,
    projectRoot: options.projectRoot
  });

  index.runs.push(entry);
  index.updatedAt = new Date().toISOString();

  await writeHistoryIndex(index, { historyIndexPath });

  return {
    historyIndexPath,
    entry
  };
}

function buildHistoryEntry(options) {
  const trace = options.trace;
  const projectRoot = resolveProjectRoot(options.projectRoot);

  const resultExtras = toHistoryEntryExtras(options.result || {});

  return {
    runId: trace.runId,
    createdAt: normalizeString(trace.createdAt) || new Date().toISOString(),
    goal: normalizeString(trace.goal),
    finalStatus: normalizeString(trace.finalStatus),
    attempts: normalizeAttempts(trace.attempts),
    stepCount: Array.isArray(trace.steps) ? trace.steps.length : 0,
    traceRelPath: toRelPath(options.tracePath, projectRoot),
    outboxRelPath: toRelPath(options.outboxPath, projectRoot),
    planRelPath: toRelPath(options.planPath, projectRoot),
    exitCode: resultExtras.exitCode,
    errorCode: resultExtras.errorCode
  };
}

function resolveProjectRoot(input) {
  if (typeof input === 'string' && input.trim() !== '') {
    return path.resolve(input);
  }

  return path.resolve(__dirname, '../../..');
}

function toRelPath(filePath, projectRoot) {
  if (typeof filePath !== 'string' || filePath.trim() === '') {
    return null;
  }

  return path.relative(projectRoot, path.resolve(filePath)).split(path.sep).join('/');
}

function normalizeAttempts(value) {
  if (!Number.isInteger(value) || value < 1) {
    return 1;
  }

  return value;
}

function normalizeString(value) {
  if (value == null) return null;

  const v = String(value).trim();

  return v === '' ? null : v;
}

module.exports = {
  appendHistoryEntry,
  buildHistoryEntry
};
