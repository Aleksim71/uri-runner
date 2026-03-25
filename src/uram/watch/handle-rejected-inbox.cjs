// path: src/uram/watch/handle-rejected-inbox.cjs
'use strict';

const fs = require('node:fs');
const path = require('node:path');

function moveToRejected({ sourceFile, rejectedDir }) {
  if (!fs.existsSync(sourceFile)) return;

  if (!fs.existsSync(rejectedDir)) {
    fs.mkdirSync(rejectedDir, { recursive: true });
  }

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const target = path.join(rejectedDir, ts + '__rejected__inbox.zip');

  fs.renameSync(sourceFile, target);

  return target;
}

module.exports = { moveToRejected };
