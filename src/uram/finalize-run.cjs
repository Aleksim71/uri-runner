"use strict";

const fs = require("fs/promises");
const path = require("path");

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

async function appendJsonl(filePath, obj) {
  await fs.appendFile(filePath, `${JSON.stringify(obj)}\n`, "utf-8");
}

async function atomicCopyToLatest(srcFile, latestPath, runId) {
  const dir = path.dirname(latestPath);
  await ensureDir(dir);

  const tmp = path.join(dir, `.tmp.latest.${runId}.zip`);
  await fs.copyFile(srcFile, tmp);
  await fs.rename(tmp, latestPath);
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
  const ok = exitCode === 0;
  const statusText = ok ? "OK" : "FAIL";

  const historyOutboxName = `${stamp}__${executionKind}__${statusText}__${runId}.outbox.zip`;
  const historyOutboxPath = path.join(historyDir, historyOutboxName);

  await fs.rename(tmpOutboxPath, historyOutboxPath);
  await atomicCopyToLatest(historyOutboxPath, latestOutboxPath, runId);

  const durationMs = Date.now() - startedAt;
  const indexPath = path.join(historyDir, "index.jsonl");

  await appendJsonl(indexPath, {
    ts: new Date().toISOString(),
    run_id: runId,
    project,
    engine: executionKind,
    ok,
    exit_code: exitCode,
    duration_ms: durationMs,
    cwd,
    inbox_name: path.basename(inboxZipPath),
    outbox_rel_path: path.join("history", historyOutboxName),
    loaded_commands: loadedCommands,
  });

  const processedInboxName = `${stamp}__${project}__${runId}.inbox.zip`;
  const processedInboxPath = path.join(processedDir, processedInboxName);

  await fs.rename(inboxZipPath, processedInboxPath);

  if (!quiet) {
    console.log(`[uri] run: latest=${latestOutboxPath}`);
    console.log(`[uri] run: history=${historyOutboxPath}`);
    console.log(`[uri] run: inbox processed=${processedInboxPath}`);
  }

  return historyOutboxPath;
}

module.exports = { finalizeRun };
