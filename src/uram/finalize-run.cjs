"use strict";

const fs = require("fs/promises");
const path = require("path");

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function appendJsonl(filePath, obj) {
  await fs.appendFile(filePath, `${JSON.stringify(obj)}\n`, "utf-8");
}

async function readJsonArrayOrEmpty(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw);

    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    if (err && err.code === "ENOENT") {
      return [];
    }

    throw err;
  }
}

async function writeJsonAtomic(filePath, value, tmpSuffix) {
  const dir = path.dirname(filePath);
  await ensureDir(dir);

  const tmpPath = path.join(
    dir,
    `.tmp.${path.basename(filePath)}.${tmpSuffix}`
  );

  await fs.writeFile(tmpPath, JSON.stringify(value, null, 2), "utf-8");
  await fs.rename(tmpPath, filePath);
}

async function atomicCopyToLatest(srcFile, latestPath, runId) {
  const dir = path.dirname(latestPath);
  await ensureDir(dir);

  const tmpPath = path.join(dir, `.tmp.latest.${runId}.zip`);
  await fs.copyFile(srcFile, tmpPath);
  await fs.rename(tmpPath, latestPath);
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
}) {
  await ensureDir(historyDir);
  await ensureDir(processedDir);

  const ok = exitCode === 0;
  const statusText = ok ? "OK" : "FAIL";

  const historyOutboxName =
    `${stamp}__${executionKind}__${statusText}__${runId}.outbox.zip`;
  const historyOutboxPath = path.join(historyDir, historyOutboxName);

  await fs.rename(tmpOutboxPath, historyOutboxPath);
  await atomicCopyToLatest(historyOutboxPath, latestOutboxPath, runId);

  const durationMs = Date.now() - startedAt;

  const entry = {
    ts: new Date().toISOString(),

    // canonical camelCase fields
    runId,
    project,
    executionKind,
    ok,
    exitCode,
    durationMs,
    cwd,
    inboxName: path.basename(inboxZipPath),
    outboxRelPath: path.join("history", historyOutboxName),
    loadedCommands: Array.isArray(loadedCommands) ? loadedCommands : [],

    // compatibility aliases
    run_id: runId,
    engine: executionKind,
    exit_code: exitCode,
    duration_ms: durationMs,
    inbox_name: path.basename(inboxZipPath),
    outbox_rel_path: path.join("history", historyOutboxName),
    loaded_commands: Array.isArray(loadedCommands) ? loadedCommands : [],
  };

  // Keep JSONL log for append-only history
  const indexJsonlPath = path.join(historyDir, "index.jsonl");
  await appendJsonl(indexJsonlPath, entry);

  // Also maintain index.json array because tests and tooling expect it
  const indexJsonPath = path.join(historyDir, "index.json");
  const index = await readJsonArrayOrEmpty(indexJsonPath);
  index.push(entry);
  await writeJsonAtomic(indexJsonPath, index, runId);

  const processedInboxName = `${stamp}__${project}__${runId}.inbox.zip`;
  const processedInboxPath = path.join(processedDir, processedInboxName);

  await fs.rename(inboxZipPath, processedInboxPath);

  if (!quiet) {
    console.log(`[uri] run: latest=${latestOutboxPath}`);
    console.log(`[uri] run: history=${historyOutboxPath}`);
    console.log(`[uri] run: history-index=${indexJsonPath}`);
    console.log(`[uri] run: inbox processed=${processedInboxPath}`);
  }

  return historyOutboxPath;
}

module.exports = { finalizeRun };
