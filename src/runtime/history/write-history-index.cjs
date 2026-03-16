'use strict';

const fs = require('fs');
const path = require('path');

const {
  normalizeHistoryIndex,
  validateHistoryIndex
} = require('./history-index-schema.cjs');

const {
  resolveHistoryIndexPath
} = require('./read-history-index.cjs');

async function writeHistoryIndex(index, options = {}) {
  const indexPath = resolveHistoryIndexPath(options.historyIndexPath);
  const normalized = normalizeHistoryIndex(index, new Date().toISOString());

  normalized.updatedAt = new Date().toISOString();

  validateHistoryIndex(normalized);

  await fs.promises.mkdir(path.dirname(indexPath), { recursive: true });
  await fs.promises.writeFile(
    indexPath,
    JSON.stringify(normalized, null, 2) + '\n',
    'utf8'
  );

  return {
    indexPath,
    index: normalized
  };
}

module.exports = {
  writeHistoryIndex
};
