const { createWatchTerminalUi } = require('../ui/watch-terminal-ui.cjs');

const watchUi = createWatchTerminalUi();
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
const { handleIntakeDecision } = require("./watch/intake-decision.cjs");
const { getFileFingerprint } = require("./watch/file-fingerprint.cjs");
const { DedupeCache } = require("./watch/dedupe-cache.cjs");
const {
  loadPiligrimState,
  incrementOperationCount,
  syncPiligrimConfig,
  createInvalidInboxHelpOutbox,
} = require("../cli/lib/piligrim-support.cjs");

const seenSourceInboxes = new DedupeCache();

let lastPiligrimHintKey = null;

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

function projectRoot() {
  return path.resolve(__dirname, "..", "..");
}

function defaultConfigPath() {
  return path.join(projectRoot(), "config", "watch.json");
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

  const watchRoot = pickFirst(
    config.watchRoot,
    config.runtimeRoot,
    path.join(uramRoot, "runtime", "watch")
  );

  return {
    config,
    configPath,
    uramRoot: path.resolve(uramRoot),
    watchRoot: path.resolve(watchRoot),
  };
}

function resolvePaths(config, uramRoot, watchRoot) {
  const downloadsDir = pickFirst(
    config.downloads,
    config.downloadsDir,
    config.paths && config.paths.downloads,
    defaultDownloadsDir()
  );

  const inboxDir = pickFirst(
    config.inbox,
    config.inboxDir,
    config.paths && config.paths.inbox,
    path.join(uramRoot, "intake", "Inbox")
  );

  const processedDir = pickFirst(
    config.processed,
    config.processedDir,
    config.paths && config.paths.processed,
    path.join(watchRoot, "processed")
  );

  const processedSourceDir = pickFirst(
    config.processedSource,
    config.processedSourceDir,
    config.paths && config.paths.processedSource,
    config.paths && config.paths.processed_source,
    path.join(uramRoot, "intake", "source-processed")
  );

  const lastRun = pickFirst(
    config.lastRun,
    config.last_run,
    config.paths && config.paths.lastRun,
    config.paths && config.paths.last_run,
    path.join(watchRoot, "last_run.txt")
  );

  return {
    downloadsDir,
    inboxDir,
    processedDir,
    processedSourceDir,
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

async function writeInvalidInboxHelpArtifacts({
  processedDir,
  projectCtx,
  sourceFile,
  reason,
  projectName = "tempasi",
}) {
  const targets = [];

  if (typeof processedDir === "string" && processedDir.trim().length > 0) {
    targets.push(path.join(processedDir, "outbox.zip"));
  }

  if (
    projectCtx &&
    typeof projectCtx.outboxDir === "string" &&
    projectCtx.outboxDir.trim().length > 0
  ) {
    targets.push(path.join(projectCtx.outboxDir, "outbox.zip"));
  }

  const uniqueTargets = [...new Set(targets)];
  const validationPayload = {
    status: "error",
    code: "watch_invalid_inbox",
    message: `Inbox validation failed during watch intake: ${reason || "invalid_inbox"}`,
    details: {
      inboxZipPath:
        typeof sourceFile === "string" && sourceFile.trim().length > 0
          ? path.resolve(sourceFile)
          : null,
      reason: reason || "invalid_inbox",
    },
  };

  for (const outboxZipPath of uniqueTargets) {
    await createInvalidInboxHelpOutbox({
      outboxZipPath,
      projectName,
      validation: validationPayload,
    });
  }

  if (typeof processedDir === "string" && processedDir.trim().length > 0) {
    await fsp.writeFile(
      path.join(processedDir, "outbox.json"),
      JSON.stringify(validationPayload, null, 2) + "\n",
      "utf8"
    );
  }
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

function restoreInboxZipIfMissing(targetPath, sourcePath, archivedSourcePath) {
  if (fs.existsSync(targetPath)) {
    return;
  }

  const restoreSource =
    (sourcePath && fs.existsSync(sourcePath) && sourcePath) ||
    (archivedSourcePath && fs.existsSync(archivedSourcePath) && archivedSourcePath) ||
    null;

  if (!restoreSource) {
    return;
  }

  copyInboxToTarget(restoreSource, targetPath);
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
  const isInteractiveTerminal =
    Boolean(stdout && stdout.isTTY) &&
    !process.env.VITEST &&
    !process.env.CI;

  if (!isInteractiveTerminal) {
    writeLine(stdout, "");
    writeLine(stdout, "URI WATCH");
    writeLine(stdout, "────────────────────────");
    writeLine(stdout, `mode: ${options.mode}`);
    if (options.transport) {
      writeLine(stdout, `transport: ${options.transport}`);
    }
    writeLine(stdout, "status: started");
    writeLine(stdout, `config: ${options.configPath || "<missing>"}`);
    writeLine(stdout, `source: ${options.downloadsDir || "<unknown>"}`);
    writeLine(stdout, `inbox: ${options.inboxDir || "<unknown>"}`);
    writeLine(stdout, `processed: ${options.processedDir || "<unknown>"}`);
    return;
  }

  watchUi.resetSections();

  const meta = [];
  meta.push(['mode', options.mode || 'once']);

  if (watchUi && watchUi.renderer && watchUi.renderer.theme) {
    meta.push(['theme', watchUi.renderer.theme.mode]);
    meta.push(['preset', watchUi.renderer.theme.preset]);

    if (watchUi.renderer.theme.configPath) {
      meta.push(['config', watchUi.renderer.theme.configPath]);
    }
  }

  if (options.transport) {
    meta.push(['transport', options.transport]);
  }

  meta.push(['watchConfig', options.configPath || '<missing>']);
  meta.push(['source', options.downloadsDir || '<unknown>']);
  meta.push(['inbox', options.inboxDir || '<unknown>']);
  meta.push(['processed', options.processedDir || '<unknown>']);

  watchUi.printBanner(meta);
  watchUi.printLegacyStatus('started');
}

async function printPiligrimWatcherHints(stdout, config = {}, options = {}) {
  const piligrimConfig =
    config && typeof config === "object" && config.piligrim && typeof config.piligrim === "object"
      ? config.piligrim
      : {};

  await syncPiligrimConfig(piligrimConfig);
  const piligrimState = await loadPiligrimState();

  const counterText = `${Number(piligrimState?.operation_count || 0)}/${Number(piligrimState?.operation_limit || 0)}`;
  const allowReady =
    options && typeof options === "object" && options.allowReadyForChat === true;

  let nextHintKey = `none:${counterText}`;

  if (allowReady && piligrimState && piligrimState.piligrim_ready_for_handoff) {
    nextHintKey = `ready:${counterText}`;
  } else if (piligrimState && piligrimState.piligrim_update_needed) {
    nextHintKey = `update_required:${counterText}`;
  }

  if (nextHintKey === lastPiligrimHintKey) {
    return piligrimState;
  }

  lastPiligrimHintKey = nextHintKey;

  printStatus(stdout, "piligrim counter", {
    progress: counterText,
  });

  if (nextHintKey.startsWith("ready:")) {
    printStatus(stdout, "ready for new chat");
    printStatus(stdout, "hint", {
      command: "run uri handoff",
    });
    return piligrimState;
  }

  if (nextHintKey.startsWith("update_required:")) {
    printStatus(stdout, "piligrim update required");
    printStatus(stdout, "hint", {
      command: "update project part and run uri piligrim mark-updated",
    });
    return piligrimState;
  }

  return piligrimState;
}

function printStatus(stdout, status, extra = {}) {
  const isInteractiveTerminal =
    Boolean(stdout && stdout.isTTY) &&
    !process.env.VITEST &&
    !process.env.CI;

  if (!isInteractiveTerminal) {
    writeLine(stdout, `status: ${status}`);
    for (const [key, value] of Object.entries(extra)) {
      if (value === undefined || value === null || value === "") {
        continue;
      }
      writeLine(stdout, `${key}: ${value}`);
    }
    return;
  }

  const normalized = String(status || '').toLowerCase();
  let state = 'info';

  if (
    normalized === 'accepted' ||
    normalized === 'execution completed' ||
    normalized === 'completed'
  ) {
    state = 'success';
  } else if (
    normalized === 'execution failed' ||
    normalized === 'config_error'
  ) {
    state = 'error';
  } else if (
    normalized === 'inbox.zip detected' ||
    normalized === 'waiting for inbox.zip' ||
    normalized === 'stopping' ||
    normalized === 'execution started' ||
    normalized === 'no inbox.zip found'
  ) {
    state = 'warn';
  }

  watchUi.printStatus('status', status, state);

  for (const [key, value] of Object.entries(extra)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }

    if (key === 'project') {
      watchUi.printStatus('project', String(value), 'accent');
      continue;
    }

    if (key === 'archivedSource') {
      watchUi.printArtifact('archivedSource', String(value));
      continue;
    }

    watchUi.printArtifact(key, String(value));
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
}

function pickExistingOutboxPath(primaryPath, fallbackPath) {
  if (primaryPath && fs.existsSync(primaryPath)) {
    return primaryPath;
  }

  return fallbackPath || null;
}

function buildPublishedStatusPayload(outboxPayload) {
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

  if (typeof outboxPayload?.executionKind === "string" && outboxPayload.executionKind.trim()) {
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

function buildPublishedSnapshotText(statusPayload) {
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

async function overwriteZipEntry(zipPath, relativePath, content) {
  if (!zipPath || !fs.existsSync(zipPath)) {
    return;
  }

  const { execFileSync } = require("child_process");
  const patchRoot = await fsp.mkdtemp(path.join(path.dirname(zipPath), ".watch-outbox-patch-"));
  const absPath = path.join(patchRoot, relativePath);

  try {
    await fsp.mkdir(path.dirname(absPath), { recursive: true });
    await fsp.writeFile(absPath, content, "utf8");

    try {
      execFileSync("zip", ["-q", "-d", zipPath, relativePath], {
        stdio: "ignore",
      });
    } catch {
      // ignore if entry does not exist
    }

    execFileSync("zip", ["-q", zipPath, relativePath], {
      cwd: patchRoot,
      stdio: "ignore",
    });
  } finally {
    await fsp.rm(patchRoot, { recursive: true, force: true });
  }
}

async function publishPipelineFailureOutbox({
  processedDir,
  projectOutboxDir = null,
  outboxPayload,
}) {
  if (!outboxPayload || typeof outboxPayload !== "object" || Array.isArray(outboxPayload)) {
    return;
  }

  const statusPayload = buildPublishedStatusPayload(outboxPayload);
  const outboxJson = JSON.stringify(outboxPayload, null, 2) + "\n";
  const statusJson = JSON.stringify(statusPayload, null, 2) + "\n";
  const snapshotText = buildPublishedSnapshotText(statusPayload);

  const targets = [
    {
      dir: processedDir,
      zipPath: path.join(processedDir, "outbox.zip"),
      jsonPath: path.join(processedDir, "outbox.json"),
    },
  ];

  if (typeof projectOutboxDir === "string" && projectOutboxDir.trim()) {
    targets.push({
      dir: projectOutboxDir,
      zipPath: path.join(projectOutboxDir, "outbox.zip"),
      jsonPath: path.join(projectOutboxDir, "outbox.json"),
    });
  }

  for (const target of targets) {
    if (!target.dir) {
      continue;
    }

    await fsp.mkdir(target.dir, { recursive: true });
    await fsp.writeFile(target.jsonPath, outboxJson, "utf8");

    if (fs.existsSync(target.zipPath)) {
      await overwriteZipEntry(target.zipPath, "outbox.json", outboxJson);
      await overwriteZipEntry(target.zipPath, "REPORT/outbox.json", outboxJson);
      await overwriteZipEntry(target.zipPath, "STATUS.json", statusJson);
      await overwriteZipEntry(target.zipPath, "REPORT/status.json", statusJson);
      await overwriteZipEntry(target.zipPath, "SNAPSHOT.txt", snapshotText);
    }
  }
}

async function runPipelineFullCycle({ uramRoot, watchRoot, inboxDir, processedDir, runbook, hooks = {} }) {
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
    inboxZipPath: path.join(inboxDir, "inbox.zip"),
    hooks,
  });

  const copiedArtifacts = await copyLatestOutboxArtifacts({
    uramRoot,
    processedDir,
    projectName,
  });

  if (
    pipelineResult &&
    pipelineResult.ok === false &&
    pipelineResult.outboxPayload &&
    typeof pipelineResult.outboxPayload === "object" &&
    !Array.isArray(pipelineResult.outboxPayload)
  ) {
    await publishPipelineFailureOutbox({
      processedDir,
      projectOutboxDir: projectOwned.projectCtx?.outboxDir || null,
      outboxPayload: pipelineResult.outboxPayload,
    });
  }

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
    transportMode = null,
  } = options;

  const inspection = await inspectInboxZip(fullPath);

  if (!inspection.accepted) {
    if (inspection.reason === "missing_runbook") {
      await writeInvalidInboxHelpArtifacts({
        processedDir,
        sourceFile: fullPath,
        reason: inspection.reason,
        projectName: "tempasi",
      });

      handleIntakeDecision({
        sourceFile: fullPath,
        decision: "accepted",
        reason: inspection.reason,
        log: (line) => writeLine(stdout, line),
      });

      return {
        handled: true,
        accepted: false,
        reason: inspection.reason,
        status: "validation_error",
        deduped: false,
        alreadyLogged: true,
        sourceZipPath: fullPath,
      };
    }

    const decision = handleIntakeDecision({
      sourceFile: fullPath,
      decision: "ignored",
      reason: inspection.reason,
      log: (line) => writeLine(stdout, line),
    });

    return {
      handled: decision.action !== "dedupe_skip",
      accepted: false,
      reason: inspection.reason,
      status: inspection.reason,
      deduped: decision.action === "dedupe_skip",
      alreadyLogged: true,
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

  if (transportMode === "project-owned") {
    const projectName =
      inspection.runbook && typeof inspection.runbook.project === "string"
        ? inspection.runbook.project.trim()
        : "";

    if (!projectName) {
      return {
        handled: true,
        accepted: false,
        status: "validation_error",
        reason: "project is required for project-owned transport",
        runbook: inspection.runbook,
        archivedSourcePath,
      };
    }

    try {
      await resolveProjectContext({
        uramRoot,
        project: projectName,
      });
    } catch (error) {
      return {
        handled: true,
        accepted: false,
        status: "validation_error",
        reason: error && error.message ? error.message : String(error),
        runbook: inspection.runbook,
        archivedSourcePath,
      };
    }
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
        inboxDir,
        processedDir,
        runbook: inspection.runbook,
        hooks: {
          onStepStart(step) {
            const label =
              step.command ||
              [step.kind, step.action].filter(Boolean).join(".") ||
              [step.type, step.action].filter(Boolean).join(".") ||
              step.stepId ||
              "step";
            watchUi.printStatus("step", `${label} …`, "warn");
          },
          onStepSuccess(step) {
            const label =
              step.command ||
              [step.kind, step.action].filter(Boolean).join(".") ||
              [step.type, step.action].filter(Boolean).join(".") ||
              step.stepId ||
              "step";
            watchUi.printStatus("step", `${label} ✔`, "success");
          },
          
          onStepOutput(event) {
            const line = event && event.line ? String(event.line) : "";
            if (!line.trim()) return;
            watchUi.printStatus("output", `  ↳ ${line}`, "info");
          },
onStepError(step) {
            const label =
              step.command ||
              [step.kind, step.action].filter(Boolean).join(".") ||
              [step.type, step.action].filter(Boolean).join(".") ||
              step.stepId ||
              "step";
            watchUi.printStatus("step", `${label} ✖`, "error");
          },
        },
      });

      const pipelineResult = execution.pipelineResult || {};
      const ok = pipelineResult.ok !== false;

      if (!ok) {
        printStatus(stdout, "execution failed", {
          outbox: execution.projectOutboxZipPath || execution.outboxZipPath || undefined,
          outboxJson: execution.projectOutboxJsonPath || execution.outboxJsonPath || undefined,
          transportOutbox: execution.transportOutboxZipPath || undefined,
        });

  // === A38 SUMMARY HOOK (error) ===
  try {
    watchUi.printSummary({
      result: 'error'
    });
  } catch (e) {}

        restoreInboxZipIfMissing(target, fullPath, archivedSourcePath);

        return {
          handled: true,
          accepted: true,
          ok: true,
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

  // === A38 SUMMARY HOOK (success) ===
  try {
    watchUi.printSummary({
      result: 'success'
    });
  } catch (e) {}

      restoreInboxZipIfMissing(target, fullPath, archivedSourcePath);

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
      restoreInboxZipIfMissing(target, fullPath, archivedSourcePath);

      return {
        handled: true,
        accepted: true,
        ok: true,
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
      transport: config.transportMode || config.transport || undefined,
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

  await printPiligrimWatcherHints(stdout, config, { allowReadyForChat: true });

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

    const sourceFp = getFileFingerprint(fullPath);
    if (seenSourceInboxes.isDuplicate(sourceFp)) {
      continue;
    }
    seenSourceInboxes.remember(sourceFp);

    printStatus(stdout, "inbox.zip detected");

    const result = await handleInboxZip(fullPath, {
      uramRoot,
      watchRoot,
      inboxDir,
      processedDir,
      processedSourceDir,
      executeFullCycle,
      archiveSource,
      transportMode: config.transportMode || config.transport || null,
      stdout,
    });

    if (
      result &&
      typeof result.runId === "string" &&
      result.runId.trim().length > 0
    ) {
      safeWriteLastRun(lastRun, result.runId.trim());
    }

    if (!executeFullCycle) {
      if (result.accepted) {
        printStatus(stdout, "accepted", {
          runId: result.runId,
          extractedInbox: result.extractedInboxDir,
          plan: result.planPath,
          archivedSource: result.archivedSourcePath || undefined,
        });
      } else if (!result.alreadyLogged) {
        printStatus(
          stdout,
          result.status === "validation_error" ? "validation_error" : "ignored",
          {
            reason: result.reason,
          }
        );
      }
    } else if (!result.accepted && !result.alreadyLogged) {
      printStatus(
        stdout,
        result.status === "validation_error" ? "validation_error" : "ignored",
        {
          reason: result.reason,
        }
      );
    }

    if (
      executeFullCycle &&
      result &&
      result.accepted &&
      (result.status === "completed" || result.status === "failed")
    ) {
      await incrementOperationCount();
      await printPiligrimWatcherHints(stdout, config, { allowReadyForChat: false });
    }

    return result;
  }

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
    transport: loaded.config.transportMode || loaded.config.transport || undefined,
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
