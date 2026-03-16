'use strict';

const fs = require('fs');
const path = require('path');

function findStaleHistoryEntries(index, options = {}) {
  const runsDir = resolveRunsDir(options);
  const runs = Array.isArray(index && index.runs) ? index.runs : [];

  const staleRuns = [];
  const activeRuns = [];

  for (const entry of runs) {
    const runId = normalizeRunId(entry && entry.runId);

    if (!runId) {
      staleRuns.push({
        runId: null,
        reason: 'missing_run_id',
        entry
      });
      continue;
    }

    const runDir = path.join(runsDir, runId);
    const exists = fs.existsSync(runDir);

    if (exists) {
      activeRuns.push(entry);
      continue;
    }

    staleRuns.push({
      runId,
      reason: 'missing_run_dir',
      runDir,
      entry
    });
  }

  return {
    runsDir,
    scannedRuns: runs.length,
    activeRuns,
    staleRuns,
    staleRunIds: staleRuns
      .map((item) => item.runId)
      .filter(Boolean)
  };
}

function resolveRunsDir(options = {}) {
  if (typeof options.runsDir === 'string' && options.runsDir.trim() !== '') {
    return path.resolve(options.runsDir);
  }

  if (typeof options.projectRoot === 'string' && options.projectRoot.trim() !== '') {
    return path.resolve(options.projectRoot, 'runtime', 'runs');
  }

  return path.resolve(__dirname, '../../../runtime/runs');
}

function normalizeRunId(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const v = value.trim();
  return v === '' ? null : v;
}

module.exports = {
  findStaleHistoryEntries
};
