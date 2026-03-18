"use strict";

const fs = require("fs");
const path = require("path");
const unzipper = require("unzipper");
const YAML = require("yaml");
const { materializePlanFromRunbook } = require("../runtime/materialize-plan.cjs");

function loadConfig() {
  const configPath = process.env.URI_CONFIG;
  if (!configPath) {
    throw new Error("URI_CONFIG not set");
  }

  const raw = fs.readFileSync(configPath, "utf8");
  const config = JSON.parse(raw);

  return {
    config,
    configPath,
    rootDir: path.dirname(configPath),
  };
}

function pickFirst(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  return undefined;
}

function resolvePaths(config, rootDir) {
  const downloadsDir = pickFirst(
    config.downloads,
    config.downloadsDir,
    config.paths && config.paths.downloads,
    path.join(rootDir, "Downloads")
  );

  const inboxDir = pickFirst(
    config.inbox,
    config.inboxDir,
    config.paths && config.paths.inbox,
    path.join(rootDir, "Inbox")
  );

  const processedDir = pickFirst(
    config.processed,
    config.processedDir,
    config.paths && config.paths.processed,
    path.join(rootDir, "processed")
  );

  const lastRun = pickFirst(
    config.lastRun,
    config.last_run,
    config.paths && config.paths.lastRun,
    config.paths && config.paths.last_run,
    path.join(rootDir, "last_run.txt")
  );

  return {
    downloadsDir,
    inboxDir,
    processedDir,
    lastRun,
  };
}

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function safeWriteLastRun(filePath) {
  try {
    ensureParentDir(filePath);
    fs.writeFileSync(filePath, `${new Date().toISOString()}\n`, "utf8");
  } catch {
    // last_run must never break watcher
  }
}

function writeProcessedMarker(processedDir) {
  const markerPath = path.join(processedDir, "inbox.processed.txt");
  ensureParentDir(markerPath);
  fs.writeFileSync(markerPath, "accepted inbox.zip\n", "utf8");
}

function findRunbookEntry(directory) {
  return directory.files.find((entry) => {
    const normalized = entry.path.replace(/\\/g, "/");
    const base = normalized.split("/").pop();
    return base === "RUNBOOK.yaml";
  });
}

async function readZipDirectory(zipPath) {
  return unzipper.Open.file(zipPath);
}

async function readEntryText(entry) {
  const buffer = await entry.buffer();
  return buffer.toString("utf8");
}

function parseRunbookYaml(yamlText, zipPath) {
  let parsed;
  try {
    parsed = YAML.parse(yamlText);
  } catch {
    return {
      ok: false,
      reason: "broken_yaml",
      zipPath,
    };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {
      ok: false,
      reason: "invalid_root",
      zipPath,
    };
  }

  return {
    ok: true,
    runbook: parsed,
  };
}

function isAcceptedReceiver(runbook) {
  return runbook && runbook.receiver === "uri";
}

function createRunId(now = new Date()) {
  const iso = now.toISOString().replace(/[:.]/g, "-");
  const random = Math.random().toString(36).slice(2, 8);
  return `run_${iso}_${random}`;
}

function buildRunArtifactsDir(rootDir, runId) {
  return path.join(rootDir, "runs", runId);
}

function copyInboxToTarget(sourcePath, targetPath) {
  ensureParentDir(targetPath);
  fs.copyFileSync(sourcePath, targetPath);
}

function isBrokenZipError(error) {
  if (!error) {
    return false;
  }

  const message = typeof error.message === "string" ? error.message : "";
  return error.code === "FILE_ENDED" || message.includes("FILE_ENDED");
}

async function inspectInboxZip(zipPath) {
  let directory;
  try {
    directory = await readZipDirectory(zipPath);
  } catch (error) {
    if (isBrokenZipError(error)) {
      return {
        accepted: false,
        reason: "broken_zip",
      };
    }
    throw error;
  }

  const runbookEntry = findRunbookEntry(directory);

  if (!runbookEntry) {
    return {
      accepted: false,
      reason: "missing_runbook",
    };
  }

  let yamlText;
  try {
    yamlText = await readEntryText(runbookEntry);
  } catch (error) {
    if (isBrokenZipError(error)) {
      return {
        accepted: false,
        reason: "broken_zip",
      };
    }
    throw error;
  }

  const parsed = parseRunbookYaml(yamlText, zipPath);

  if (!parsed.ok) {
    return {
      accepted: false,
      reason: parsed.reason,
    };
  }

  if (!isAcceptedReceiver(parsed.runbook)) {
    return {
      accepted: false,
      reason: "foreign_receiver",
    };
  }

  return {
    accepted: true,
    runbook: parsed.runbook,
  };
}

async function extractZipToDir(zipPath, targetDir) {
  ensureDir(targetDir);

  await fs
    .createReadStream(zipPath)
    .pipe(unzipper.Extract({ path: targetDir }))
    .promise();
}

async function handleInboxZip(fullPath, options) {
  const { rootDir, inboxDir, processedDir } = options;

  const inspection = await inspectInboxZip(fullPath);

  if (!inspection.accepted) {
    return {
      handled: false,
      accepted: false,
      reason: inspection.reason,
    };
  }

  const target = path.join(inboxDir, "inbox.zip");
  copyInboxToTarget(fullPath, target);
  writeProcessedMarker(processedDir);

  const runId = createRunId();
  const artifactsDir = buildRunArtifactsDir(rootDir, runId);
  const extractedInboxDir = path.join(artifactsDir, "inbox");

  ensureDir(artifactsDir);
  await extractZipToDir(target, extractedInboxDir);

  const materialized = materializePlanFromRunbook({
    inboxDir: extractedInboxDir,
    artifactsDir,
  });

  return {
    handled: true,
    accepted: true,
    runId,
    inboxZipPath: target,
    extractedInboxDir,
    planPath: materialized.planPath,
  };
}

async function watchInboxOnce() {
  const { config, rootDir } = loadConfig();
  const { downloadsDir, inboxDir, processedDir, lastRun } = resolvePaths(
    config,
    rootDir
  );

  fs.mkdirSync(downloadsDir, { recursive: true });
  fs.mkdirSync(inboxDir, { recursive: true });
  fs.mkdirSync(processedDir, { recursive: true });

  const files = fs.readdirSync(downloadsDir).sort();

  for (const name of files) {
    const fullPath = path.join(downloadsDir, name);
    const stat = fs.statSync(fullPath);

    if (!stat.isFile()) {
      continue;
    }

    if (name !== "inbox.zip") {
      continue;
    }

    const result = await handleInboxZip(fullPath, {
      rootDir,
      inboxDir,
      processedDir,
    });

    safeWriteLastRun(lastRun);

    if (result.accepted) {
      console.log(`accepted: ${name}`);
      console.log(`runId: ${result.runId}`);
      console.log(`extractedInbox: ${result.extractedInboxDir}`);
      console.log(`plan: ${result.planPath}`);
    } else {
      console.log(`ignored: ${name} (${result.reason})`);
    }

    return result;
  }

  safeWriteLastRun(lastRun);

  return {
    handled: false,
    accepted: false,
    reason: "no_inbox_zip",
  };
}

if (require.main === module) {
  watchInboxOnce().catch((error) => {
    console.error(error && error.stack ? error.stack : String(error));
    process.exitCode = 1;
  });
}

module.exports = {
  watchInboxOnce,
  loadConfig,
  resolvePaths,
  findRunbookEntry,
  inspectInboxZip,
  handleInboxZip,
};
