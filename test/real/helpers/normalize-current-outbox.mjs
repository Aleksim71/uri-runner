// path: test/real/helpers/normalize-current-outbox.mjs
import fs from 'node:fs/promises';
import path from 'node:path';

async function readJsonIfExists(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function listReportFiles(reportDir) {
  try {
    const names = await fs.readdir(reportDir);
    return names.sort();
  } catch {
    return [];
  }
}

function deriveStatus({ statusJson, outboxJson }) {
  const source = outboxJson || statusJson || {};
  const explicitStatus =
    typeof source.status === 'string' ? source.status.toLowerCase() : null;

  const hardErrorCodes = new Set([
    'RUNBOOK_INVALID',
    'RUNBOOK_MISSING',
    'INBOX_MISSING',
    'PIPELINE_INTERNAL_ERROR',
  ]);

  const errorCode =
    outboxJson?.error?.code ||
    statusJson?.error?.code ||
    null;

  if (errorCode && hardErrorCodes.has(errorCode)) {
    return 'error';
  }

  if (typeof outboxJson?.ok === 'boolean') {
    return outboxJson.ok ? 'success' : 'failed';
  }

  if (typeof statusJson?.ok === 'boolean') {
    return statusJson.ok ? 'success' : 'failed';
  }

  if (Number.isInteger(outboxJson?.exitCode)) {
    return outboxJson.exitCode === 0 ? 'success' : 'failed';
  }

  if (explicitStatus === 'ok') {
    return 'success';
  }

  if (explicitStatus === 'success' || explicitStatus === 'failed' || explicitStatus === 'error') {
    return explicitStatus;
  }

  return 'unknown';
}

function deriveStopReason({ statusJson, outboxJson }) {
  const source = outboxJson || statusJson || {};

  if (typeof source.stopReason === 'string' && source.stopReason.trim()) {
    return source.stopReason;
  }

  if (typeof source.reason === 'string' && source.reason.trim()) {
    return source.reason;
  }

  const readiness = outboxJson?.audit?.server?.readiness;
  if (outboxJson?.audit?.server?.ok === false && readiness && readiness.ok === false) {
    return 'service_not_ready_timeout';
  }

  return null;
}

export async function normalizeCurrentOutbox(outboxDir) {
  const statusJson = await readJsonIfExists(path.join(outboxDir, 'STATUS.json'));
  const outboxJson = await readJsonIfExists(path.join(outboxDir, 'outbox.json'));
  const reportFiles = await listReportFiles(path.join(outboxDir, 'REPORT'));

  return {
    status: deriveStatus({ statusJson, outboxJson }),
    attempts: Number(outboxJson?.attempts ?? statusJson?.attempts ?? 1),
    stopReason: deriveStopReason({ statusJson, outboxJson }),
    exitCode: Number.isInteger(outboxJson?.exitCode) ? outboxJson.exitCode : null,
    hasSnapshot: await fileExists(path.join(outboxDir, 'SNAPSHOT.txt')),
    reportFiles,
  };
}
