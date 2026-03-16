'use strict';

const fs = require('fs');
const path = require('path');

const {
  normalizeHistoryIndex,
  validateHistoryIndex
} = require('./history-index-schema.cjs');

async function writeHistoryIndex(index, options = {}) {
  const indexPath = resolveHistoryIndexPath(options.historyIndexPath);
  const tempPath = `${indexPath}.tmp`;

  const normalized = normalizeHistoryIndex(index, new Date().toISOString());

  validateHistoryIndex(normalized);

  await fs.promises.mkdir(path.dirname(indexPath), { recursive: true });
  await fs.promises.writeFile(tempPath, JSON.stringify(normalized, null, 2));
  await fs.promises.rename(tempPath, indexPath);

  return {
    indexPath,
    runs: normalized.runs.length
  };
}

function resolveHistoryIndexPath(inputPath) {
  if (typeof inputPath === 'string' && inputPath.trim() !== '') {
    return path.resolve(inputPath);
  }

  return path.resolve(__dirname, '../../../runtime/history/index.json');
}

module.exports = {
  writeHistoryIndex,
  resolveHistoryIndexPath
};
