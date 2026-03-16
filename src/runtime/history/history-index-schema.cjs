'use strict';

const HISTORY_INDEX_VERSION = 1;

function createEmptyHistoryIndex(now = new Date().toISOString()) {
  return {
    version: HISTORY_INDEX_VERSION,
    updatedAt: now,
    runs: []
  };
}

function normalizeHistoryIndex(input, now = new Date().toISOString()) {
  const source = input && typeof input === 'object' ? input : {};

  return {
    version: Number.isInteger(source.version) && source.version > 0
      ? source.version
      : HISTORY_INDEX_VERSION,
    updatedAt: normalizeString(source.updatedAt) || now,
    runs: Array.isArray(source.runs)
      ? source.runs.map(normalizeRunEntry).filter(Boolean)
      : []
  };
}

function normalizeRunEntry(input) {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const runId = normalizeString(input.runId);

  if (!runId) {
    return null;
  }

  return {
    runId,
    createdAt: normalizeString(input.createdAt),
    goal: normalizeString(input.goal),
    finalStatus: normalizeString(input.finalStatus),
    attempts: normalizePositiveInteger(input.attempts, 1),
    stepCount: normalizePositiveInteger(input.stepCount, 0),
    traceRelPath: normalizeString(input.traceRelPath),
    outboxRelPath: normalizeString(input.outboxRelPath),
    planRelPath: normalizeString(input.planRelPath)
  };
}

function validateHistoryIndex(index) {
  if (!index || typeof index !== 'object') {
    throw new Error('history-index-schema: index must be an object');
  }

  if (!Number.isInteger(index.version) || index.version < 1) {
    throw new Error('history-index-schema: version must be a positive integer');
  }

  if (!Array.isArray(index.runs)) {
    throw new Error('history-index-schema: runs must be an array');
  }

  const seen = new Set();

  for (const run of index.runs) {
    if (!run || typeof run !== 'object') {
      throw new Error('history-index-schema: run entry must be an object');
    }

    if (!normalizeString(run.runId)) {
      throw new Error('history-index-schema: runId is required');
    }

    if (seen.has(run.runId)) {
      throw new Error(`history-index-schema: duplicate runId: ${run.runId}`);
    }

    seen.add(run.runId);
  }

  return true;
}

function normalizeString(value) {
  if (value == null) return null;

  const v = String(value).trim();

  return v === '' ? null : v;
}

function normalizePositiveInteger(value, fallback) {
  if (!Number.isInteger(value) || value < 0) {
    return fallback;
  }

  return value;
}

module.exports = {
  HISTORY_INDEX_VERSION,
  createEmptyHistoryIndex,
  normalizeHistoryIndex,
  normalizeRunEntry,
  validateHistoryIndex
};
