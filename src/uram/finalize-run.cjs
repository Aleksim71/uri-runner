"use strict";

const fsp = require("fs/promises");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

async function ensureDir(p) {
  await fsp.mkdir(p, { recursive: true });
}

async function writeJson(p, obj) {
  await fsp.writeFile(p, JSON.stringify(obj, null, 2) + "\n", "utf8");
}

async function readJsonSafe(p) {
  try {
    const raw = await fsp.readFile(p, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function copyDirRecursive(srcDir, destDir) {
  await ensureDir(destDir);

  const entries = await fsp.readdir(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      await copyDirRecursive(srcPath, destPath);
      continue;
    }

    if (entry.isFile()) {
      await ensureDir(path.dirname(destPath));
      await fsp.copyFile(srcPath, destPath);
    }
  }
}

async function buildOutboxZip({
  tmpOutboxPath,
  latestOutboxPath,
  historyOutboxPath,
  tmpProvidedDir = null,
}) {
  const outboxPayload = await readJsonSafe(tmpOutboxPath);

  if (!outboxPayload || typeof outboxPayload !== "object") {
    throw new Error("tmp outbox payload is missing or invalid");
  }

  const stagingRoot = `${tmpOutboxPath}.staging`;
  await fsp.rm(stagingRoot, { recursive: true, force: true });
  await ensureDir(stagingRoot);

  const outboxJsonPath = path.join(stagingRoot, "outbox.json");
  await writeJson(outboxJsonPath, outboxPayload);

  if (tmpProvidedDir) {
    const providedSrc = path.join(tmpProvidedDir, "provided");
    try {
      const stat = await fsp.stat(providedSrc);
      if (stat.isDirectory()) {
        await copyDirRecursive(providedSrc, path.join(stagingRoot, "provided"));
      }
    } catch {
      // no provided dir -> ignore
    }
  }

  await fsp.rm(latestOutboxPath, { force: true });
  await fsp.rm(historyOutboxPath, { force: true });

  await execFileAsync("zip", ["-rq", latestOutboxPath, "."], {
    cwd: stagingRoot,
  });

  await fsp.copyFile(latestOutboxPath, historyOutboxPath);

  await fsp.rm(stagingRoot, { recursive: true, force: true });
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
  tmpProvidedDir = null,
}) {
  const historyIndexPath = path.join(historyDir, "index.json");
  const historyJsonlPath = path.join(historyDir, "index.jsonl");
  const historyOutboxPath = path.join(
    historyDir,
    `${runId}__${executionKind}__${exitCode === 0 ? "OK" : "ERR"}.outbox.zip`
  );

  await ensureDir(historyDir);
  await ensureDir(processedDir);

  await buildOutboxZip({
    tmpOutboxPath,
    latestOutboxPath,
    historyOutboxPath,
    tmpProvidedDir,
  });

  const runRecord = {
    runId,
    project,
    executionKind,
    exitCode,
    startedAt,
    finishedAt: Date.now(),
    cwd,
    loadedCommands,
    outboxPath: path.basename(historyOutboxPath),
  };

  if (planRelPath) {
    runRecord.planRelPath = planRelPath;
  }

  await fsp.appendFile(
    historyJsonlPath,
    JSON.stringify(runRecord) + "\n",
    "utf8"
  );

  const existingIndex = (await readJsonSafe(historyIndexPath)) || {
    version: 1,
    runs: [],
  };

  existingIndex.runs.push(runRecord);

  await writeJson(historyIndexPath, existingIndex);

  const processedName = `${runId}.inbox.zip`;
  const processedPath = path.join(processedDir, processedName);

  try {
    await fsp.rename(inboxZipPath, processedPath);
  } catch {
    // ignore
  }

  await fsp.rm(tmpOutboxPath, { force: true });

  if (tmpProvidedDir) {
    await fsp.rm(tmpProvidedDir, { recursive: true, force: true });
  }

  if (!quiet) {
    console.log(`[uri] finalize: run ${runId} stored`);
  }
}

module.exports = {
  finalizeRun,
};
