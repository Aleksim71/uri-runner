/* path: src/uram/finalize-run.cjs */
"use strict";

const fsp = require("fs/promises");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

async function ensureDir(dirPath) {
  await fsp.mkdir(dirPath, { recursive: true });
}

async function writeJson(filePath, value) {
  await ensureDir(path.dirname(filePath));
  await fsp.writeFile(
    filePath,
    JSON.stringify(value, null, 2) + "\n",
    "utf8"
  );
}

async function readJsonSafe(filePath, fallback = null) {
  try {
    const raw = await fsp.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function looksLikeScenarioSummary(value) {
  return Boolean(
    isObject(value) &&
      ("ok" in value ||
        "engine" in value ||
        "exitCode" in value ||
        "error" in value ||
        "runId" in value)
  );
}

function normalizeTmpPayload(rawValue) {
  if (!isObject(rawValue)) {
    return rawValue;
  }

  if (looksLikeScenarioSummary(rawValue)) {
    return rawValue;
  }

  const preferredKeys = [
    "outboxPayload",
    "outbox",
    "payload",
    "result",
    "report",
    "summary",
    "data",
  ];

  for (const key of preferredKeys) {
    const nested = rawValue[key];
    if (isObject(nested) && looksLikeScenarioSummary(nested)) {
      return nested;
    }
  }

  return rawValue;
}

function buildMinimalSuccessOutbox(summary) {
  const outbox = {
    status:
      typeof summary?.status === "string" && summary.status.trim()
        ? summary.status
        : "success",
    attempts:
      Number.isInteger(summary?.attempts) && summary.attempts > 0
        ? summary.attempts
        : 1,
  };

  if (Array.isArray(summary?.provided) && summary.provided.length > 0) {
    outbox.provided = summary.provided;
  }

  if (Array.isArray(summary?.trace) && summary.trace.length > 0) {
    outbox.trace = summary.trace;
  }

  // === MVP preserve scenario report fields ===
  if (summary?.sourceScenario && typeof summary.sourceScenario === "object") {
    outbox.sourceScenario = summary.sourceScenario;
  }

  if (summary?.executedScenario && typeof summary.executedScenario === "object") {
    outbox.executedScenario = summary.executedScenario;
  }

  if (Array.isArray(summary?.steps)) {
    outbox.steps = summary.steps;
  }

  if (Array.isArray(summary?.checks)) {
    outbox.checks = summary.checks;
  }

  if (summary?.fileDeliveryReport && typeof summary.fileDeliveryReport === "object") {
    outbox.fileDeliveryReport = summary.fileDeliveryReport;
  }

  return outbox;
}

function detectFailureFromPayload(payload, exitCode) {
  if (Number.isInteger(exitCode) && exitCode !== 0) {
    return true;
  }

  if (!isObject(payload)) {
    return false;
  }

  if (payload.ok === false) {
    return true;
  }

  if (Number.isInteger(payload.exitCode) && payload.exitCode !== 0) {
    return true;
  }

  const status =
    typeof payload.status === "string" && payload.status.trim()
      ? payload.status.trim().toLowerCase()
      : "";

  if (status && !["success", "ok", "completed"].includes(status)) {
    return true;
  }

  if (isObject(payload.error)) {
    return true;
  }

  if (Array.isArray(payload.trace) && payload.trace.length > 0) {
    return true;
  }

  return false;
}

function buildStatusPayload(outboxPayload) {
  const payload = {
    status:
      typeof outboxPayload?.status === "string" && outboxPayload.status.trim()
        ? outboxPayload.status
        : "unknown",
  };

  if (Number.isInteger(outboxPayload?.attempts) && outboxPayload.attempts > 0) {
    payload.attempts = outboxPayload.attempts;
  }

  if (typeof outboxPayload?.runId === "string" && outboxPayload.runId.trim()) {
    payload.runId = outboxPayload.runId;
  }

  if (typeof outboxPayload?.project === "string" && outboxPayload.project.trim()) {
    payload.project = outboxPayload.project;
  }

  if (typeof outboxPayload?.engine === "string" && outboxPayload.engine.trim()) {
    payload.engine = outboxPayload.engine;
  }

  if (
    typeof outboxPayload?.executionKind === "string" &&
    outboxPayload.executionKind.trim()
  ) {
    payload.executionKind = outboxPayload.executionKind;
  }

  if (typeof outboxPayload?.stage === "string" && outboxPayload.stage.trim()) {
    payload.stage = outboxPayload.stage;
  }

  if (typeof outboxPayload?.ok === "boolean") {
    payload.ok = outboxPayload.ok;
  }

  return payload;
}

function buildSnapshotText(statusPayload) {
  const lines = [`status: ${statusPayload.status}`];

  if (Number.isInteger(statusPayload.attempts)) {
    lines.push(`attempts: ${statusPayload.attempts}`);
  }

  if (typeof statusPayload.runId === "string") {
    lines.push(`runId: ${statusPayload.runId}`);
  }

  if (typeof statusPayload.engine === "string") {
    lines.push(`engine: ${statusPayload.engine}`);
  }

  if (typeof statusPayload.executionKind === "string") {
    lines.push(`executionKind: ${statusPayload.executionKind}`);
  }

  if (typeof statusPayload.stage === "string") {
    lines.push(`stage: ${statusPayload.stage}`);
  }

  if (typeof statusPayload.project === "string") {
    lines.push(`project: ${statusPayload.project}`);
  }

  if (typeof statusPayload.ok === "boolean") {
    lines.push(`ok: ${statusPayload.ok ? "true" : "false"}`);
  }

  return `${lines.join("\n")}\n`;
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

async function buildZipArtifact({
  zipPath,
  outboxPayload,
  tmpProvidedDir = null,
}) {
  const stagingRoot = `${zipPath}.staging`;

  await fsp.rm(stagingRoot, { recursive: true, force: true });
  await fsp.rm(zipPath, { force: true });
  await ensureDir(stagingRoot);

  const statusPayload = buildStatusPayload(outboxPayload);

  await writeJson(path.join(stagingRoot, "outbox.json"), outboxPayload);
  await writeJson(path.join(stagingRoot, "STATUS.json"), statusPayload);
  await fsp.writeFile(
    path.join(stagingRoot, "SNAPSHOT.txt"),
    buildSnapshotText(statusPayload),
    "utf8"
  );
  await writeJson(path.join(stagingRoot, "REPORT", "outbox.json"), outboxPayload);
  await writeJson(path.join(stagingRoot, "REPORT", "status.json"), statusPayload);

  if (tmpProvidedDir) {
    const providedSrc = path.join(tmpProvidedDir, "provided");

    try {
      const stat = await fsp.stat(providedSrc);

      if (stat.isDirectory()) {
        await copyDirRecursive(providedSrc, path.join(stagingRoot, "provided"));
      }
    } catch {
      // ignore missing provided dir
    }
  }

  await execFileAsync("zip", ["-rDq", zipPath, "."], {
    cwd: stagingRoot,
  });

  await fsp.rm(stagingRoot, { recursive: true, force: true });
}

async function appendLegacyHistoryIndex(filePath, runRecord) {
  const current = (await readJsonSafe(filePath, [])) || [];
  const arr = Array.isArray(current) ? current : [];
  arr.push(runRecord);
  await writeJson(filePath, arr);
}

async function appendStructuredHistoryIndex(filePath, runRecord) {
  const current = (await readJsonSafe(filePath, null)) || {
    version: 1,
    runs: [],
  };

  const doc =
    isObject(current) && !Array.isArray(current)
      ? current
      : { version: 1, runs: [] };

  if (!Array.isArray(doc.runs)) {
    doc.runs = [];
  }

  doc.runs.push(runRecord);
  await writeJson(filePath, doc);
}

async function writeProjectOutbox({
  projectOutboxDir,
  outboxPayload,
  tmpProvidedDir = null,
}) {
  if (typeof projectOutboxDir !== "string" || !projectOutboxDir.trim()) {
    return { outboxZipPath: null, outboxJsonPath: null };
  }

  const outboxZipPath = path.join(projectOutboxDir, "outbox.zip");
  const outboxJsonPath = path.join(projectOutboxDir, "outbox.json");

  await ensureDir(projectOutboxDir);
  await buildZipArtifact({
    zipPath: outboxZipPath,
    outboxPayload,
    tmpProvidedDir,
  });
  await writeJson(outboxJsonPath, outboxPayload);

  return { outboxZipPath, outboxJsonPath };
}

async function writeProjectFailedLog({
  projectFailedLogsDir,
  runId,
  outboxPayload,
  tmpProvidedDir = null,
}) {
  if (typeof projectFailedLogsDir !== "string" || !projectFailedLogsDir.trim()) {
    return null;
  }

  const runDir = path.join(projectFailedLogsDir, runId);
  const outboxZipPath = path.join(runDir, "outbox.zip");
  const outboxJsonPath = path.join(runDir, "outbox.json");

  await ensureDir(runDir);
  await buildZipArtifact({
    zipPath: outboxZipPath,
    outboxPayload,
    tmpProvidedDir,
  });
  await writeJson(outboxJsonPath, outboxPayload);

  return runDir;
}

async function finalizeRun({
  tmpOutboxPath,
  latestOutboxPath,
  historyDir,
  inboxZipPath,
  processedDir,
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
  projectOutboxDir = null,
  projectFailedLogsDir = null,
}) {
  const historyJsonlPath = path.join(historyDir, "index.jsonl");
  const historyIndexPath = path.join(historyDir, "index.json");
  const historyOutboxPath = path.join(
    historyDir,
    `${runId}__${executionKind}__${exitCode === 0 ? "OK" : "ERR"}.outbox.zip`
  );

  await ensureDir(historyDir);
  await ensureDir(processedDir);

  const rawPayload = await readJsonSafe(tmpOutboxPath);
  const payload = normalizeTmpPayload(rawPayload);

  if (!isObject(payload)) {
    throw new Error("tmp outbox payload is missing or invalid");
  }

  const isSuccess = !detectFailureFromPayload(payload, exitCode);

  const latestZipPath = latestOutboxPath.endsWith(".zip")
    ? latestOutboxPath
    : `${latestOutboxPath}.zip`;

  if (isSuccess) {
    const successOutbox = buildMinimalSuccessOutbox(payload);

    await buildZipArtifact({
      zipPath: latestZipPath,
      outboxPayload: successOutbox,
      tmpProvidedDir,
    });

    await buildZipArtifact({
      zipPath: historyOutboxPath,
      outboxPayload: successOutbox,
      tmpProvidedDir,
    });

    await writeProjectOutbox({
      projectOutboxDir,
      outboxPayload: successOutbox,
      tmpProvidedDir,
    });
  } else {
    const errorOutbox =
      looksLikeScenarioSummary(payload)
        ? {
            ...payload,
            runId: payload.runId || runId,
            project: payload.project || project,
            engine: payload.engine || executionKind,
            exitCode: Number.isInteger(payload.exitCode) ? payload.exitCode : exitCode,
            ok: payload.ok === true ? true : false,
            error: payload.error || {
              name: "Error",
              code: "RUNTIME_ERROR",
              message: "Runtime failed",
              details: {},
            },
          }
        : {
            runId,
            project,
            engine: executionKind,
            exitCode,
            ok: false,
            error: payload.error || {
              name: "Error",
              code: "RUNTIME_ERROR",
              message: "Runtime failed",
              details: {},
            },
          };

    await buildZipArtifact({
      zipPath: latestZipPath,
      outboxPayload: errorOutbox,
      tmpProvidedDir,
    });

    await buildZipArtifact({
      zipPath: historyOutboxPath,
      outboxPayload: errorOutbox,
      tmpProvidedDir,
    });

    await writeProjectOutbox({
      projectOutboxDir,
      outboxPayload: errorOutbox,
      tmpProvidedDir,
    });

    await writeProjectFailedLog({
      projectFailedLogsDir,
      runId,
      outboxPayload: errorOutbox,
      tmpProvidedDir,
    });
  }

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

  if (isSuccess) {
    await appendStructuredHistoryIndex(historyIndexPath, runRecord);
  } else {
    await appendLegacyHistoryIndex(historyIndexPath, runRecord);
  }

  const processedName = `__${project}__${runId}.inbox.zip`;
  const processedPath = path.join(processedDir, processedName);

  try {
    await fsp.rename(inboxZipPath, processedPath);
  } catch {
    // ignore cleanup rename failures
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
