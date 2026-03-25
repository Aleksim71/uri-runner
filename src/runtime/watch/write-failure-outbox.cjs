// path: src/runtime/watch/write-failure-outbox.cjs

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { zipSync, strToU8 } = require('fflate');

function toPlainError(error) {
  if (!error) {
    return { message: 'Unknown execution failure' };
  }

  return {
    name: error.name || 'Error',
    code: error.code || null,
    message: error.message || String(error),
    stack: typeof error.stack === 'string' ? error.stack : null
  };
}

function safeJson(value) {
  return JSON.stringify(value, null, 2) + '\n';
}

function buildSnapshot(status, details) {
  const lines = [
    `result: ${status}`,
    `time: ${new Date().toISOString()}`,
    `platform: ${process.platform}`,
    `node: ${process.version}`,
    `cwd: ${process.cwd()}`
  ];

  if (details && details.error && details.error.message) {
    lines.push(`error: ${details.error.message}`);
  }

  return lines.join(os.EOL) + os.EOL;
}

function writeFailureOutbox(options) {
  const targetZip = options && options.targetZip;
  if (!targetZip) {
    throw new Error('writeFailureOutbox: targetZip is required');
  }

  const error = toPlainError(options.error);
  const meta = {
    status: 'failed',
    stage: options.stage || 'execution',
    project: options.project || null,
    receiver: options.receiver || 'uri',
    profile: options.profile || null,
    failedAt: new Date().toISOString(),
    error
  };

  const files = {
    'STATUS.json': strToU8(safeJson(meta)),
    'SNAPSHOT.txt': strToU8(buildSnapshot('failed', meta)),
    'REPORT/error.json': strToU8(safeJson(error)),
    'REPORT/error.txt': strToU8(
      `${error.name || 'Error'}: ${error.message || 'Unknown error'}\n\n${error.stack || ''}\n`
    )
  };

  if (options.runbookJson) {
    files['REPORT/runbook.json'] = strToU8(
      typeof options.runbookJson === 'string'
        ? options.runbookJson
        : safeJson(options.runbookJson)
    );
  }

  const outDir = path.dirname(targetZip);
  fs.mkdirSync(outDir, { recursive: true });

  const zipped = zipSync(files, { level: 6 });
  fs.writeFileSync(targetZip, Buffer.from(zipped));

  return {
    targetZip,
    status: 'failed'
  };
}

module.exports = {
  writeFailureOutbox
};
