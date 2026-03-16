'use strict';

const fs = require('fs');
const path = require('path');

const {
  createEmptyHistoryIndex,
  normalizeHistoryIndex,
  validateHistoryIndex
} = require('./history-index-schema.cjs');

async function readHistoryIndex(options = {}) {
  const indexPath = resolveHistoryIndexPath(options.historyIndexPath);

  if (!fs.existsSync(indexPath)) {
    return {
      indexPath,
      exists: false,
      index: createEmptyHistoryIndex()
    };
  }

  const raw = await fs.promises.readFile(indexPath, 'utf8');
  const parsed = JSON.parse(raw);
  const index = normalizeHistoryIndex(parsed);

  validateHistoryIndex(index);

  return {
    indexPath,
    exists: true,
    index
  };
}

function resolveHistoryIndexPath(inputPath) {
  if (typeof inputPath === 'string' && inputPath.trim() !== '') {
    return path.resolve(inputPath);
  }

  return path.resolve(__dirname, '../../../runtime/history/index.json');
}

module.exports = {
  readHistoryIndex,
  resolveHistoryIndexPath
};
