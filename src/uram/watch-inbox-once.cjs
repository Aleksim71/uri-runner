/* path: src/uram/watch-inbox-once.cjs */
"use strict";

const fs = require("fs");
const fsp = require("fs/promises");
const os = require("os");
const path = require("path");
const unzipper = require("unzipper");
const YAML = require("yaml");
const { materializePlanFromRunbook } = require("../runtime/materialize-plan.cjs");
const { runUramPipeline } = require("./pipeline.cjs");
const { resolveProjectContext } = require("./project-resolver.cjs");
const { buildWatchPaths } = require("../runtime/watch-paths.cjs");

function pickFirst(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  return undefined;
}

function defaultWorkspaceRoot() {
  return path.join(os.homedir(), "workspace");
}

function defaultUramRoot() {
  return path.join(defaultWorkspaceRoot(), "uram");
}

function defaultDownloadsDir() {
  const homeDir = os.homedir();
  const localizedDownloads = path.join(homeDir, "Загрузки");
  const englishDownloads = path.join(homeDir, "Downloads");

  if (fs.existsSync(localizedDownloads)) {
    return localizedDownloads;
  }

  if (fs.existsSync(englishDownloads)) {
    return englishDownloads;
  }

  return path.join(homeDir, "Downloads");
}

function defaultConfigPath() {
  return buildWatchPaths().configPath;
}

function resolveConfigPath(explicitConfigPath) {
  if (explicitConfigPath && explicitConfigPath.trim()) {
    return path.resolve(explicitConfigPath);
  }

  if (process.env.URI_CONFIG && process.env.URI_CONFIG.trim()) {
    return path.resolve(process.env.URI_CONFIG);
  }

  const fallback = defaultConfigPath();
  if (fs.existsSync(fallback)) {
    return fallback;
  }

  return null;
}

function loadConfig(options = {}) {
  const configPath = resolveConfigPath(options.configPath);

  if (!configPath) {
    throw new Error(
      `URI_CONFIG not set, --config was not provided, and default config was not found: ${defaultConfigPath()}`
    );
  }

  const raw = fs.readFileSync(configPath, "utf8");
  const config = JSON.parse(raw);

  const uramRoot = pickFirst(
    config.uramRoot,
    config.root,
    config.dataRoot,
    path.dirname(path.dirname(configPath))
  );

  const resolved = buildWatchPaths({
    configPath,
    config,
    uramRoot,
  });

  return {
    config,
    configPath,
    uramRoot: resolved.uramRoot,
    watchRoot: resolved.watchRoot,
  };
}

function resolvePaths(config, uramRoot, watchRoot) {
  const resolved = buildWatchPaths({
    config,
    uramRoot,
    watchRoot,
  });

  return {
    downloadsDir: resolved.downloadsDir,
    inboxDir: resolved.inboxDir,
    processedDir: resolved.processedDir,
    processedSourceDir: resolved.processedSourceDir,
    lastRun: resolved.lastRun,
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

function buildRunArtifactsDir(watchRoot, runId) {
  return path.join(watchRoot, "runs", runId);
}

function copyInboxToTarget(sourcePath, targetPath) {
  ensureParentDir(targetPath);
  fs.copyFileSync(sourcePath, targetPath);
}

function archiveSourceZip(sourcePath, processedSourceDir) {
  ensureDir(processedSourceDir);

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const parsed = path.parse(sourcePath);
  const targetPath = path.join(processedSourceDir, `${parsed.name}.${stamp}${parsed.ext}`);

  try {
    fs.renameSync(sourcePath, targetPath);
    return targetPath;
  } catch {
    fs.copyFileSync(sourcePath, targetPath);
    fs.unlinkSync(sourcePath);
    return targetPath;
  }
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

function writeLine(stream, text = "") {
  if (stream && typeof stream.write === "function") {
    stream.write(`${text}\n`);
  }
}

function printBanner(options) {
  const stdout = options.stdout || process.stdout;
  writeLine(stdout, "");
  writeLine(stdout, "URI WATCH");
  writeLine(stdout, "────────────────────────");
  writeLine(stdout, `mode: ${options.mode}`);
  writeLine(stdout, "status: started");
  writeLine(stdout, `config: ${options.configPath || "<missing>"}`);
  writeLine(stdout, `source: ${options.downloadsDir || "<unknown>"}`);
  writeLine(stdout, `inbox: ${options.inboxDir || "<unknown>"}`);
  writeLine(stdout, `processed: ${options.processedDir || "<unknown>"}`);
}

function printStatus(stdout, status, extra = {}) {
  writeLine(stdout, `status: ${status}`);
  for (const [key, value] of Object.entries(extra)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    writeLine(stdout, `${key}: ${value}`);
  }
}

function buildLatestOutboxZipPath(uramRoot, projectName) {
  return path.join(uramRoot, `${projectName}Box`, "outbox.latest.zip");
}

async function copyLatestOutboxArtifacts({ uramRoot, processedDir, projectName }) {
  const latestOutboxZipPath = buildLatestOutboxZipPath(uramRoot, projectName);

  if (!fs.existsSync(latestOutboxZipPath)) {
    return {
      ok: false,
      reason: "outbox_latest_zip_missing",
      latestOutboxZipPath,
    };
  }

  ensureDir(processedDir);

  const targetZipPath = path.join(processedDir, "outbox.zip");
  await fsp.copyFile(latestOutboxZipPath, targetZipPath);

  let targetJsonPath = null;
  try {
    const directory = await unzipper.Open.file(latestOutboxZipPath);
    const outboxEntry = directory.files.find((entry) => {
      const normalized = entry.path.replace(/\\/g, "/");
      return normalized.split("/").pop() === "outbox.json";
    });

    if (outboxEntry) {
      const text = await readEntryText(outboxEntry);
      targetJsonPath = path.join(processedDir, "outbox.json");
      await fsp.writeFile(targetJsonPath, text, "utf8");
    }
  } catch {
    // ignore extraction failures; zip itself is still copied
  }

  return {
    ok: true,
    latestOutboxZipPath,
    outboxZipPath: targetZipPath,
    outboxJsonPath: targetJsonPath,
  };
}


async function resolveProjectOwnedOutboxPaths(uramRoot, projectName) {
  try {
    const projectCtx = await resolveProjectContext({
      uramRoot,
      project: projectName,
    });

    if (!projectCtx || !projectCtx.outboxDir) {
      return {
        projectCtx,
        projectOutboxZipPath: null,
        projectOutboxJsonPath: null,
      };
    }

    const projectOutboxZipPath = path.join(projectCtx.outboxDir, "outbox.zip");
    const projectOutboxJsonPath = path.join(projectCtx.outboxDir, "outbox.json");

    return {
      projectCtx,
      projectOutboxZipPath,
      projectOutboxJsonPath,
    };
  } catch {
    return {
      projectCtx: null,
      projectOutboxZipPath: null,
      projectOutboxJsonPath: null,
    };
  }
}

function pickExistingOutboxPath(primaryPath, fallbackPath) {
  if (primaryPath && fs.existsSync(primaryPath)) {
    return primaryPath;
  }

  return fallbackPath || null;
}

async function runPipelineFullCycle({ uramRoot, watchRoot, processedDir, runbook }) {
  const projectName =
    runbook && typeof runbook.project === "string" && runbook.project.trim()
      ? runbook.project.trim()
      : "unknown";

  const projectOwned = await resolveProjectOwnedOutboxPaths(uramRoot, projectName);

  const pipelineResult = await runUramPipeline({
    uramCli: uramRoot,
    workspaceCli: path.join(watchRoot, "tmp"),
    quiet: true,
    env: process.env,
    homeDir: os.homedir(),
  });

  const copiedArtifacts = await copyLatestOutboxArtifacts({
    uramRoot,
    processedDir,
    projectName,
  });

  return {
    pipelineResult,
    projectName,
    projectCtx: projectOwned.projectCtx || null,
    projectOutboxZipPath: pickExistingOutboxPath(
      projectOwned.projectOutboxZipPath,
      copiedArtifacts.outboxZipPath
    ),
    projectOutboxJsonPath: pickExistingOutboxPath(
      projectOwned.projectOutboxJsonPath,
      copiedArtifacts.outboxJsonPath
    ),
    transportOutboxZipPath: copiedArtifacts.outboxZipPath || null,
    transportOutboxJsonPath: copiedArtifacts.outboxJsonPath || null,
    ...copiedArtifacts,
  };
}

async function handleInboxZip(fullPath, options) {
  const {
    uramRoot,
    watchRoot,
    inboxDir,
    processedDir,
    processedSourceDir,
    executeFullCycle = false,
    stdout = process.stdout,
    archiveSource = false,
  } = options;

  const inspection = await inspectInboxZip(fullPath);

  if (!inspection.accepted) {
    return {
      handled: false,
      accepted: false,
      reason: inspection.reason,
      status: inspection.reason,
      sourceZipPath: fullPath,
    };
  }

  const target = path.join(inboxDir, "inbox.zip");
  copyInboxToTarget(fullPath, target);
  writeProcessedMarker(processedDir);

  let archivedSourcePath = null;
  if (archiveSource) {
    archivedSourcePath = archiveSourceZip(fullPath, processedSourceDir);
  }

  if (executeFullCycle) {
    printStatus(stdout, "accepted", {
      project: inspection.runbook && inspection.runbook.project ? inspection.runbook.project : undefined,
      archivedSource: archivedSourcePath || undefined,
    });
    printStatus(stdout, "execution started");

    try {
      const execution = await runPipelineFullCycle({
        uramRoot,
        watchRoot,
        processedDir,
        runbook: inspection.runbook,
      });

      const pipelineResult = execution.pipelineResult || {};
      const ok = pipelineResult.ok !== false;

      if (!ok) {
        printStatus(stdout, "execution failed", {
          outbox: execution.projectOutboxZipPath || execution.outboxZipPath || undefined,
          outboxJson: execution.projectOutboxJsonPath || execution.outboxJsonPath || undefined,
          transportOutbox: execution.transportOutboxZipPath || undefined,
        });

        return {
          handled: true,
          accepted: true,
          ok: false,
          status: "failed",
          runbook: inspection.runbook,
          pipelineResult,
          outboxZipPath: execution.projectOutboxZipPath || execution.outboxZipPath,
          outboxJsonPath: execution.projectOutboxJsonPath || execution.outboxJsonPath,
          transportOutboxZipPath: execution.transportOutboxZipPath || execution.outboxZipPath,
          transportOutboxJsonPath: execution.transportOutboxJsonPath || execution.outboxJsonPath,
          archivedSourcePath,
        };
      }

      printStatus(stdout, "execution completed");
      printStatus(stdout, "completed", {
        outbox: execution.projectOutboxZipPath || execution.outboxZipPath || undefined,
        outboxJson: execution.projectOutboxJsonPath || execution.outboxJsonPath || undefined,
        transportOutbox: execution.transportOutboxZipPath || undefined,
      });

      return {
        handled: true,
        accepted: true,
        ok: true,
        status: "completed",
        runbook: inspection.runbook,
        pipelineResult,
        outboxZipPath: execution.projectOutboxZipPath || execution.outboxZipPath,
        outboxJsonPath: execution.projectOutboxJsonPath || execution.outboxJsonPath,
        transportOutboxZipPath: execution.transportOutboxZipPath || execution.outboxZipPath,
        transportOutboxJsonPath: execution.transportOutboxJsonPath || execution.outboxJsonPath,
        archivedSourcePath,
      };
    } catch (error) {
      printStatus(stdout, "execution failed", {
        error: error && error.message ? error.message : String(error),
      });

      return {
        handled: true,
        accepted: true,
        ok: false,
        status: "failed",
        runbook: inspection.runbook,
        error: error && error.message ? error.message : String(error),
        archivedSourcePath,
      };
    }
  }

  const runId = createRunId();
  const artifactsDir = buildRunArtifactsDir(watchRoot, runId);
  const extractedInboxDir = path.join(artifactsDir, "inbox");

  ensureDir(artifactsDir);
  await extractZipToDir(target, extractedInboxDir);

  const materialized = materializePlanFromRunbook({
    inboxDir: extractedInboxDir,
    runId,
    runArtifactsDir: artifactsDir,
  });

  return {
    handled: true,
    accepted: true,
    runId,
    inboxZipPath: target,
    extractedInboxDir,
    planPath: materialized.planPath,
    runbook: inspection.runbook,
    archivedSourcePath,
  };
}

async function runWatchCycle(loaded, options = {}) {
  const stdout = options.stdout || process.stdout;
  const executeFullCycle = Boolean(options.executeFullCycle);
  const archiveSource = Boolean(options.archiveSource);

  const { config, configPath, uramRoot, watchRoot } = loaded;
  const { downloadsDir, inboxDir, processedDir, processedSourceDir, lastRun } = resolvePaths(
    config,
    uramRoot,
    watchRoot
  );

  if (!options.suppressBanner) {
    printBanner({
      mode: options.mode || "once",
      configPath,
      downloadsDir,
      inboxDir,
      processedDir,
      stdout,
    });
  }

  fs.mkdirSync(downloadsDir, { recursive: true });
  fs.mkdirSync(inboxDir, { recursive: true });
  fs.mkdirSync(processedDir, { recursive: true });
  fs.mkdirSync(processedSourceDir, { recursive: true });
  fs.mkdirSync(path.join(watchRoot, "runs"), { recursive: true });
  fs.mkdirSync(path.join(watchRoot, "tmp"), { recursive: true });

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

    printStatus(stdout, "inbox.zip detected");

    const result = await handleInboxZip(fullPath, {
      uramRoot,
      watchRoot,
      inboxDir,
      processedDir,
      processedSourceDir,
      executeFullCycle,
      archiveSource,
      stdout,
    });

    safeWriteLastRun(lastRun);

    if (!executeFullCycle) {
      if (result.accepted) {
        printStatus(stdout, "accepted", {
          runId: result.runId,
          extractedInbox: result.extractedInboxDir,
          plan: result.planPath,
          archivedSource: result.archivedSourcePath || undefined,
        });
      } else {
        printStatus(stdout, "ignored", {
          reason: result.reason,
        });
      }
    }

    return result;
  }

  safeWriteLastRun(lastRun);

  if (!options.suppressNoInboxLog) {
    printStatus(stdout, "no inbox.zip found");
  }

  return {
    handled: false,
    accepted: false,
    ok: true,
    status: "no_inbox_zip_found",
    reason: "no_inbox_zip",
  };
}

async function watchInboxOnce(options = {}) {
  const stdout = options.stdout || process.stdout;

  let loaded;
  try {
    loaded = loadConfig({
      configPath: options.configPath,
    });
  } catch (error) {
    printBanner({
      mode: options.mode || "once",
      configPath: options.configPath || process.env.URI_CONFIG || defaultConfigPath(),
      stdout,
    });
    printStatus(stdout, "config_error", {
      error: error.message || String(error),
    });

    return {
      ok: false,
      status: "config_error",
      error: error.message || String(error),
    };
  }

  return runWatchCycle(loaded, {
    ...options,
    stdout,
    mode: options.mode || "once",
    suppressBanner: Boolean(options.suppressBanner),
    suppressNoInboxLog: Boolean(options.suppressNoInboxLog),
  });
}

async function runWatchLoop(options = {}) {
  const stdout = options.stdout || process.stdout;
  const intervalMs = Number.isFinite(options.intervalMs) && options.intervalMs > 0
    ? Math.floor(options.intervalMs)
    : 2000;

  let loaded;
  try {
    loaded = loadConfig({
      configPath: options.configPath,
    });
  } catch (error) {
    printBanner({
      mode: "continuous",
      configPath: options.configPath || process.env.URI_CONFIG || defaultConfigPath(),
      stdout,
    });
    printStatus(stdout, "config_error", {
      error: error.message || String(error),
    });

    return {
      ok: false,
      status: "config_error",
      error: error.message || String(error),
    };
  }

  const paths = resolvePaths(loaded.config, loaded.uramRoot, loaded.watchRoot);

  printBanner({
    mode: "continuous",
    configPath: loaded.configPath,
    downloadsDir: paths.downloadsDir,
    inboxDir: paths.inboxDir,
    processedDir: paths.processedDir,
    stdout,
  });
  printStatus(stdout, "waiting for inbox.zip");

  let stopped = false;
  const onSignal = () => {
    stopped = true;
    printStatus(stdout, "stopping");
  };

  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);

  try {
    while (!stopped) {
      const cycleResult = await runWatchCycle(loaded, {
        ...options,
        stdout,
        mode: "continuous",
        executeFullCycle: true,
        suppressBanner: true,
        suppressNoInboxLog: true,
        archiveSource: true,
      });

      if (stopped) {
        break;
      }

      if (cycleResult && cycleResult.status === "config_error") {
        return cycleResult;
      }

      if (cycleResult && (cycleResult.status === "completed" || cycleResult.status === "failed")) {
        printStatus(stdout, "waiting for inbox.zip");
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    return {
      ok: true,
      status: "stopped",
    };
  } finally {
    process.removeListener("SIGINT", onSignal);
    process.removeListener("SIGTERM", onSignal);
  }
}

if (require.main === module) {
  watchInboxOnce().catch((error) => {
    console.error(error && error.stack ? error.stack : String(error));
    process.exitCode = 1;
  });
}

module.exports = {
  watchInboxOnce,
  runWatchLoop,
  loadConfig,
  resolvePaths,
  defaultConfigPath,
  inspectInboxZip,
  handleInboxZip,
  runWatchCycle,
};
