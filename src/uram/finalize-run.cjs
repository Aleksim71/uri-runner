"use strict";

const fsp = require("fs/promises");
const path = require("path");

async function ensureDir(p) {
  await fsp.mkdir(p, { recursive: true });
}

async function writeJson(p, obj) {
  await fsp.writeFile(p, JSON.stringify(obj, null, 2), "utf8");
}

async function readJsonSafe(p) {
  try {
    const raw = await fsp.readFile(p, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function finalizeRun({
  tmpOutboxPath,
  latestOutboxPath,
  historyDir,
  inboxZipPath,
  processedDir,
  stamp,
  runId,
  project,
  executionKind,
  exitCode,
  startedAt,
  loadedCommands,
  cwd,
  quiet,
  planRelPath = null,
}) {
  const historyIndexPath = path.join(historyDir, "index.json");
  const historyJsonlPath = path.join(historyDir, "index.jsonl");

  await ensureDir(historyDir);
  await ensureDir(processedDir);

  // move outbox -> latest
  await fsp.rename(tmpOutboxPath, latestOutboxPath);

  const runRecord = {
    runId,
    project,
    executionKind,
    exitCode,
    startedAt,
    finishedAt: Date.now(),
    cwd,
    loadedCommands,
  };

  if (planRelPath) {
    runRecord.planRelPath = planRelPath;
  }

  // append jsonl
  await fsp.appendFile(
    historyJsonlPath,
    JSON.stringify(runRecord) + "\n",
    "utf8"
  );

  // update index.json
  const existingIndex = (await readJsonSafe(historyIndexPath)) || {
    version: 1,
    runs: [],
  };

  existingIndex.runs.push(runRecord);

  await writeJson(historyIndexPath, existingIndex);

  // move inbox -> processed
  const processedName = `${runId}.inbox.zip`;
  const processedPath = path.join(processedDir, processedName);

  try {
    await fsp.rename(inboxZipPath, processedPath);
  } catch {
    // ignore
  }

  if (!quiet) {
    console.log(`[uri] finalize: run ${runId} stored`);
  }
}

module.exports = {
  finalizeRun,
};
