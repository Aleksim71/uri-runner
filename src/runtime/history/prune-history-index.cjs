'use strict';

const {
  readHistoryIndex
} = require('./read-history-index.cjs');

const {
  writeHistoryIndex
} = require('./write-history-index.cjs');

const {
  findStaleHistoryEntries
} = require('./find-stale-history-entries.cjs');

async function pruneHistoryIndex(options = {}) {
  const dryRun = Boolean(options.dryRun);

  const {
    indexPath,
    exists,
    index
  } = await readHistoryIndex({
    historyIndexPath: options.historyIndexPath
  });

  const analysis = findStaleHistoryEntries(index, {
    runsDir: options.runsDir,
    projectRoot: options.projectRoot
  });

  const nextIndex = {
    ...index,
    runs: analysis.activeRuns
  };

  if (dryRun || !exists) {
    return {
      indexPath,
      exists,
      dryRun,
      scannedRuns: analysis.scannedRuns,
      keptRuns: analysis.activeRuns.length,
      prunedRuns: analysis.staleRuns.length,
      staleRuns: analysis.staleRuns,
      updated: false
    };
  }

  const result = await writeHistoryIndex(nextIndex, {
    historyIndexPath: indexPath
  });

  return {
    indexPath: result.indexPath,
    exists,
    dryRun,
    scannedRuns: analysis.scannedRuns,
    keptRuns: analysis.activeRuns.length,
    prunedRuns: analysis.staleRuns.length,
    staleRuns: analysis.staleRuns,
    updated: true
  };
}

module.exports = {
  pruneHistoryIndex
};
