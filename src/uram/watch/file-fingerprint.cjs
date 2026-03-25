// path: src/uram/watch/file-fingerprint.cjs
'use strict';

const fs = require('node:fs');

function getFileFingerprint(filePath) {
  const stat = fs.statSync(filePath);
  return {
    path: filePath,
    size: stat.size,
    mtimeMs: stat.mtimeMs
  };
}

function isSameFingerprint(a, b) {
  if (!a || !b) return false;
  return a.path === b.path && a.size === b.size && a.mtimeMs === b.mtimeMs;
}

module.exports = {
  getFileFingerprint,
  isSameFingerprint
};
