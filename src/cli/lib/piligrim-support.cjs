/* path: src/cli/lib/piligrim-support.cjs */
"use strict";

const fsp = require("fs/promises");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

const DEFAULT_STATE_PATH = path.resolve("runtime/piligrim/state.json");
const DEFAULT_OPERATION_LIMIT = 20;

function resolveOutboxDir() {
  if (process.env.URI_OUTBOX_DIR && process.env.URI_OUTBOX_DIR.trim()) {
    return path.resolve(process.env.URI_OUTBOX_DIR);
  }

  return path.resolve("/home/aleksim/workspace/projects/uri-runner/Outbox");
}

async function ensureDir(dirPath) {
  await fsp.mkdir(dirPath, { recursive: true });
}

async function readJsonSafe(filePath, fallback) {
  try {
    const raw = await fsp.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, value) {
  await ensureDir(path.dirname(filePath));
  await fsp.writeFile(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function nowIso() {
  return new Date().toISOString();
}

function buildValidInboxExample(projectName = "tempasi") {
  return [
    "version: 1",
    "receiver: uri",
    `project: ${projectName}`,
    "goal: Minimal watcher acceptance test",
    "",
    "provide: []",
    "modify: []",
    "goal_checks: []",
    "",
  ].join("\n");
}

function buildWhoAmIMd() {
  return [
    "# URI — whoami",
    "",
    "URI is an execution/runtime tool.",
    "",
    "Canonical flow:",
    "`inbox.zip -> compile -> plan -> run -> finalize -> outbox.zip`",
    "",
    "Main ideas:",
    "- project-owned routing",
    "- structured outbox",
    "- truth cycle is the main readiness check",
    "- commands are executed through registered runtime/command surfaces",
    "",
    "Supported engines:",
    "- scenario",
    "- audit",
    "",
  ].join("\n");
}

function buildCapabilitiesMd() {
  return [
    "# URI capabilities",
    "",
    "Current system is designed around:",
    "- CLI entrypoints",
    "- watcher",
    "- runbook-driven execution",
    "- command registry",
    "- outbox/history",
    "",
    "Core command roots expected by project design:",
    "- system",
    "- project",
    "",
    "Operational model:",
    "- accept inbox.zip",
    "- validate runbook",
    "- compile/execute",
    "- always produce outbox surface",
    "",
  ].join("\n");
}

function buildInvalidInboxGuideMd() {
  return [
    "# Invalid inbox guide",
    "",
    "If inbox.zip is invalid, URI must still produce outbox.zip with:",
    "- STATUS.json",
    "- REPORT/validation.json",
    "- REPORT/HOW_TO_FIX.md",
    "- REPORT/VALID_INBOX_EXAMPLE.yaml",
    "- REPORT/PILIGRIM_URI_CORE.md",
    "",
    "Typical causes:",
    "- RUNBOOK.yaml missing",
    "- version is not 1",
    "- unsupported step kind",
    "- unknown command",
    "",
  ].join("\n");
}

function buildPiligrimCoreMd() {
  return [
    "# PILIGRIM_URI_CORE",
    "",
    "## What URI is",
    "URI is an execution/runtime tool that works through inbox/outbox protocol.",
    "",
    "## Canonical flow",
    "`inbox.zip -> compile -> plan -> run -> finalize -> outbox.zip`",
    "",
    "## Valid inbox contract",
    "- archive name: `inbox.zip`",
    "- root file: `RUNBOOK.yaml`",
    "- required minimum fields:",
    "  - `version: 1`",
    "  - `receiver: uri`",
    "  - `project: <name>`",
    "  - `goal: <goal>`",
    "",
    "## Minimal valid RUNBOOK.yaml",
    "```yaml",
    buildValidInboxExample("tempasi").trimEnd(),
    "```",
    "",
    "## If inbox is invalid",
    "Read:",
    "- `REPORT/validation.json`",
    "- `REPORT/HOW_TO_FIX.md`",
    "- `REPORT/VALID_INBOX_EXAMPLE.yaml`",
    "",
    "## Handoff model",
    "- URI counts operational cycles",
    "- after limit URI asks to refresh project Piligrim part",
    "- after refresh run `uri handoff`",
    "",
  ].join("\n");
}

function buildHowToFixMd(validation) {
  const code = validation?.code || "invalid_inbox";
  const message = validation?.message || "Inbox validation failed";
  return [
    "# HOW TO FIX",
    "",
    `Error code: \`${code}\``,
    "",
    `Message: ${message}`,
    "",
    "## What to do",
    "1. Check `RUNBOOK.yaml` exists in archive root.",
    "2. Ensure `version: 1` is present.",
    "3. Use supported runbook structure for current project/runtime.",
    "4. Start from `REPORT/VALID_INBOX_EXAMPLE.yaml`.",
    "",
  ].join("\n");
}

async function loadPiligrimState(statePath = DEFAULT_STATE_PATH) {
  return readJsonSafe(statePath, {
    enabled: true,
    operation_limit: DEFAULT_OPERATION_LIMIT,
    operation_count: 0,
    piligrim_update_needed: false,
    piligrim_updated: false,
    piligrim_ready_for_handoff: false,
    updated_at: null,
  });
}

async function savePiligrimState(state, statePath = DEFAULT_STATE_PATH) {
  const nextState = {
    ...state,
    updated_at: nowIso(),
  };
  await writeJson(statePath, nextState);
  return nextState;
}

async function incrementOperationCount(statePath = DEFAULT_STATE_PATH) {
  const state = await loadPiligrimState(statePath);
  const next = {
    ...state,
    operation_count: Number(state.operation_count || 0) + 1,
  };

  if (next.operation_count >= Number(next.operation_limit || DEFAULT_OPERATION_LIMIT)) {
    next.piligrim_update_needed = true;
    next.piligrim_updated = false;
    next.piligrim_ready_for_handoff = false;
  }

  return savePiligrimState(next, statePath);
}

async function markPiligrimUpdated(statePath = DEFAULT_STATE_PATH) {
  const state = await loadPiligrimState(statePath);
  return savePiligrimState(
    {
      ...state,
      piligrim_update_needed: false,
      piligrim_updated: true,
      piligrim_ready_for_handoff: true,
    },
    statePath
  );
}

async function syncPiligrimConfig(config = {}, statePath = DEFAULT_STATE_PATH) {
  const state = await loadPiligrimState(statePath);
  const next = { ...state };

  if (typeof config.enabled === "boolean") {
    next.enabled = config.enabled;
  }

  if (Number.isFinite(config.operation_limit) && config.operation_limit > 0) {
    next.operation_limit = Math.floor(config.operation_limit);
  }

  return savePiligrimState(next, statePath);
}

function buildProjectStateMd(projectName = "unknown") {
  return [
    "# PILIGRIM_PROJECT_STATE",
    "",
    `Project: ${projectName}`,
    "",
    "## Current state",
    "- update this file with project-specific context",
    "- current goal",
    "- done",
    "- next step",
    "- risks",
    "",
  ].join("\n");
}

function buildNextStepMd() {
  return [
    "# PILIGRIM_NEXT_STEP",
    "",
    "Describe the first concrete step for the next chat here.",
    "",
  ].join("\n");
}

function buildProjectIndexMd() {
  return [
    "# PROJECT_INDEX",
    "",
    "This file is the map of maps for the project.",
    "",
    "## Read order",
    "1. PILIGRIM.md",
    "2. PILIGRIM_NEXT_STEP.md",
    "3. PROJECT_INDEX.md",
    "4. Then open the needed project map",
    "",
    "## Expected project maps",
    "- FUNCTIONAL_TREE.md",
    "- GOAL_TREE.md",
    "- FRONTEND_CHECKLIST.md",
    "- BACKEND_CHECKLIST.md",
    "- TEST_MAP.md",
    "- DOC_MAP.md",
    "- FILE_TREE.md",
    "- KNOWN_ISSUES.md / RISK_MAP.md",
    "- UNKNOWN_MAP.md",
    "",
    "## How to use",
    "- business logic -> FUNCTIONAL_TREE.md",
    "- goals / progress -> GOAL_TREE.md",
    "- UI -> FRONTEND_CHECKLIST.md",
    "- API / DB -> BACKEND_CHECKLIST.md",
    "- tests -> TEST_MAP.md",
    "- docs -> DOC_MAP.md",
    "- structure -> FILE_TREE.md",
    "- risks -> KNOWN_ISSUES.md / RISK_MAP.md",
    "",
  ].join("\n");
}

function buildPiligrimMd(projectName = "unknown") {
  return [
    "# PILIGRIM",
    "",
    "## URI core",
    "See `PILIGRIM_URI_CORE.md`.",
    "",
    "## Project state",
    `See \`PILIGRIM_PROJECT_STATE.md\` for project \`${projectName}\`.`,
    "",
    "## Next step",
    "See `PILIGRIM_NEXT_STEP.md`.",
    "",
    "## Project entry",
    "See `PROJECT_INDEX.md`.",
    "",
  ].join("\n");
}

async function writeFiles(baseDir, filesMap) {
  await ensureDir(baseDir);

  for (const [relPath, content] of Object.entries(filesMap)) {
    const absPath = path.join(baseDir, relPath);
    await ensureDir(path.dirname(absPath));
    await fsp.writeFile(absPath, content, "utf8");
  }
}

async function buildZipFromFiles(filesMap, outboxZipPath) {
  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), "uri-piligrim-"));
  await writeFiles(tempDir, filesMap);

  await ensureDir(path.dirname(outboxZipPath));

  try {
    await fsp.unlink(outboxZipPath);
  } catch {}

  await execFileAsync("zip", ["-q", "-r", outboxZipPath, "."], { cwd: tempDir });

  return {
    tempDir,
    outboxZipPath,
  };
}

async function createWhoAmIOutbox({
  outboxZipPath = path.join(resolveOutboxDir(), "outbox.zip"),
  projectName = "tempasi",
} = {}) {
  const filesMap = {
    "STATUS.json": JSON.stringify({
      status: "success",
      kind: "whoami",
      project: projectName,
      generated_at: nowIso(),
    }, null, 2) + "\n",
    "REPORT/WHOAMI.md": buildWhoAmIMd(),
    "REPORT/URI_CAPABILITIES.md": buildCapabilitiesMd(),
    "REPORT/VALID_INBOX_EXAMPLE.yaml": buildValidInboxExample(projectName),
    "REPORT/INVALID_INBOX_GUIDE.md": buildInvalidInboxGuideMd(),
    "REPORT/PILIGRIM_URI_CORE.md": buildPiligrimCoreMd(),
  };

  return buildZipFromFiles(filesMap, outboxZipPath);
}

async function createInvalidInboxHelpOutbox({
  outboxZipPath = path.join(resolveOutboxDir(), "outbox.zip"),
  projectName = "tempasi",
  validation = {},
} = {}) {
  const filesMap = {
    "STATUS.json": JSON.stringify({
      status: "error",
      kind: "invalid_inbox_help",
      project: projectName,
      generated_at: nowIso(),
    }, null, 2) + "\n",
    "REPORT/validation.json": JSON.stringify({
      status: "error",
      code: validation.code || "invalid_inbox",
      message: validation.message || "Inbox validation failed",
      details: validation.details || {},
      supported: {
        runbook_version: 1,
        step_kinds: ["command", "browser"],
      },
    }, null, 2) + "\n",
    "REPORT/HOW_TO_FIX.md": buildHowToFixMd(validation),
    "REPORT/VALID_INBOX_EXAMPLE.yaml": buildValidInboxExample(projectName),
    "REPORT/PILIGRIM_URI_CORE.md": buildPiligrimCoreMd(),
  };

  return buildZipFromFiles(filesMap, outboxZipPath);
}

async function createHandoffOutbox({
  outboxZipPath = path.join(resolveOutboxDir(), "outbox.zip"),
  projectName = "tempasi",
} = {}) {
  const state = await loadPiligrimState();

  const filesMap = {
    "STATUS.json": JSON.stringify({
      status: "success",
      kind: "handoff",
      project: projectName,
      generated_at: nowIso(),
      piligrim_update_needed: Boolean(state.piligrim_update_needed),
      piligrim_updated: Boolean(state.piligrim_updated),
      piligrim_ready_for_handoff: Boolean(state.piligrim_ready_for_handoff),
    }, null, 2) + "\n",
    "REPORT/HANDOFF_STATUS.md": [
      "# HANDOFF STATUS",
      "",
      `piligrim_update_needed: ${Boolean(state.piligrim_update_needed)}`,
      `piligrim_updated: ${Boolean(state.piligrim_updated)}`,
      `piligrim_ready_for_handoff: ${Boolean(state.piligrim_ready_for_handoff)}`,
      "",
    ].join("\n"),
    "PILIGRIM_URI_CORE.md": buildPiligrimCoreMd(),
    "PILIGRIM_PROJECT_STATE.md": buildProjectStateMd(projectName),
    "PILIGRIM_NEXT_STEP.md": buildNextStepMd(),
    "PROJECT_INDEX.md": buildProjectIndexMd(),
    "PILIGRIM.md": buildPiligrimMd(projectName),
  };

  return buildZipFromFiles(filesMap, outboxZipPath);
}

module.exports = {
  DEFAULT_STATE_PATH,
  DEFAULT_OPERATION_LIMIT,
  resolveOutboxDir,
  loadPiligrimState,
  savePiligrimState,
  incrementOperationCount,
  markPiligrimUpdated,
  syncPiligrimConfig,
  createWhoAmIOutbox,
  createInvalidInboxHelpOutbox,
  createHandoffOutbox,
};
