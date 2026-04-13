/* path: src/cli/lib/piligrim-support.cjs */
"use strict";

const fsp = require("fs/promises");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

const WORKSPACE_PROJECTS_ROOT = "/home/aleksim/workspace/projects";
const CORE_PROJECT_NAME = "uri-runner";
const DEFAULT_STATE_PATH = path.resolve("runtime/piligrim/state.json");
const DEFAULT_OPERATION_LIMIT = 20;

function normalizeProjectName(projectName = "") {
  const raw = String(projectName || "").trim();
  if (!raw) return "";
  if (raw === "uri-runner-next") return "uri-runner";
  return raw;
}

function resolveWorkspaceProjectsRoot() {
  return process.env.URI_WORKSPACE_PROJECTS_ROOT && process.env.URI_WORKSPACE_PROJECTS_ROOT.trim()
    ? path.resolve(process.env.URI_WORKSPACE_PROJECTS_ROOT)
    : path.resolve(WORKSPACE_PROJECTS_ROOT);
}

function resolveOutboxDir() {
  if (process.env.URI_OUTBOX_DIR && process.env.URI_OUTBOX_DIR.trim()) {
    return path.resolve(process.env.URI_OUTBOX_DIR);
  }
  return path.resolve("/home/aleksim/workspace/projects/uri-runner/Outbox");
}

function resolveProjectPiligrimDir(projectName) {
  const normalized = normalizeProjectName(projectName);
  if (!normalized) return null;
  return path.join(resolveWorkspaceProjectsRoot(), normalized, "context", "PILIGRIM");
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

function builtInValidInboxExample(projectName = "tempasi") {
  return [
    "version: 1",
    "receiver: uri",
    `project: ${projectName}`,
    "",
    "runtime:",
    "  engine: scenario",
    "",
    "steps:",
    "  - id: step-1",
    "    kind: command",
    "    command: system.echo",
    "    params:",
    '      message: "valid inbox example"',
    "",
  ].join("\n");
}

function builtInUriCore() {
  return [
    "# URI CORE",
    "",
    "URI is an execution/runtime tool with inbox/outbox protocol.",
    "",
    "Canonical flow:",
    "`inbox.zip -> compile -> plan -> run -> finalize -> outbox.zip`",
    "",
    "Piligrim source:",
    "`/home/aleksim/workspace/projects/<project>/context/PILIGRIM`",
    "",
  ].join("\n");
}

function builtInInvalidInboxGuide() {
  return [
    "# INVALID INBOX GUIDE",
    "",
    "If inbox.zip is invalid, URI should still produce help outbox.",
    "",
  ].join("\n");
}

function builtInProjectState(projectName = "unknown") {
  return [
    "# PROJECT STATE",
    "",
    `Project: ${projectName}`,
    "",
    "Update this file with real project state.",
    "",
  ].join("\n");
}

function builtInNextStep() {
  return [
    "# NEXT STEP",
    "",
    "Describe the next concrete step here.",
    "",
  ].join("\n");
}

function builtInProjectIndex(projectName = "unknown") {
  return [
    "# PROJECT INDEX",
    "",
    `Project: ${projectName}`,
    "",
    "Define the read order and map of maps here.",
    "",
  ].join("\n");
}

function builtInPiligrim() {
  return [
    "# PILIGRIM",
    "",
    "1. URI_CORE.md",
    "2. PROJECT_INDEX.md",
    "3. PROJECT_STATE.md",
    "4. NEXT_STEP.md",
    "",
  ].join("\n");
}

async function readTextIfExists(filePath) {
  try {
    return await fsp.readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

async function fileExists(filePath) {
  try {
    await fsp.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function collectFilesRecursive(baseDir, relativeDir = "") {
  const currentDir = path.join(baseDir, relativeDir);
  let entries = [];
  try {
    entries = await fsp.readdir(currentDir, { withFileTypes: true });
  } catch {
    return {};
  }

  const out = {};
  for (const entry of entries) {
    const relPath = path.join(relativeDir, entry.name);
    const absPath = path.join(baseDir, relPath);

    if (entry.isDirectory()) {
      Object.assign(out, await collectFilesRecursive(baseDir, relPath));
      continue;
    }

    if (!entry.isFile()) continue;
    out[relPath.replace(/\\/g, "/")] = await fsp.readFile(absPath, "utf8");
  }

  return out;
}

async function loadPiligrimFile(projectName, fileName, fallbackContent) {
  const dir = resolveProjectPiligrimDir(projectName);
  if (dir) {
    const content = await readTextIfExists(path.join(dir, fileName));
    if (typeof content === "string") {
      return content;
    }
  }
  return fallbackContent;
}

async function loadCoreFile(fileName, fallbackContent) {
  return loadPiligrimFile(CORE_PROJECT_NAME, fileName, fallbackContent);
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
      operation_count: 0,
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
  const uriCore = await loadCoreFile("URI_CORE.md", builtInUriCore());
  const validInbox = await loadCoreFile("VALID_INBOX_EXAMPLE.yaml", builtInValidInboxExample(projectName));
  const invalidGuide = await loadCoreFile("INVALID_INBOX_GUIDE.md", builtInInvalidInboxGuide());
  const filesMap = {
    "STATUS.json": JSON.stringify({
      status: "success",
      kind: "whoami",
      project: projectName,
      generated_at: nowIso(),
    }, null, 2) + "\n",
    "REPORT/WHOAMI.md": uriCore,
    "REPORT/URI_CAPABILITIES.md": [
      "# URI CAPABILITIES",
      "",
      "Source of truth for core/help files:",
      "`/home/aleksim/workspace/projects/uri-runner/context/PILIGRIM`",
      "",
      "Project handoff source:",
      "`/home/aleksim/workspace/projects/<project>/context/PILIGRIM`",
      "",
    ].join("\n"),
    "REPORT/PILIGRIM_URI_CORE.md": uriCore,
    "REPORT/VALID_INBOX_EXAMPLE.yaml": validInbox,
    "REPORT/INVALID_INBOX_GUIDE.md": invalidGuide,
  };

  return buildZipFromFiles(filesMap, outboxZipPath);
}

async function createInvalidInboxHelpOutbox({
  outboxZipPath = path.join(resolveOutboxDir(), "outbox.zip"),
  projectName = "tempasi",
  validation = {},
} = {}) {
  const uriCore = await loadCoreFile("URI_CORE.md", builtInUriCore());
  const validInbox = await loadCoreFile("VALID_INBOX_EXAMPLE.yaml", builtInValidInboxExample(projectName));
  const invalidGuide = await loadCoreFile("INVALID_INBOX_GUIDE.md", builtInInvalidInboxGuide());

  const howToFix = [
    "# HOW TO FIX",
    "",
    `Error code: \`${validation.code || "invalid_inbox"}\``,
    "",
    `Message: ${validation.message || "Inbox validation failed"}`,
    "",
    invalidGuide.trim(),
    "",
  ].join("\n");

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
    }, null, 2) + "\n",
    "REPORT/HOW_TO_FIX.md": howToFix,
    "REPORT/PILIGRIM_URI_CORE.md": uriCore,
    "REPORT/VALID_INBOX_EXAMPLE.yaml": validInbox,
  };

  return buildZipFromFiles(filesMap, outboxZipPath);
}

async function createHandoffOutbox({
  outboxZipPath = path.join(resolveOutboxDir(), "outbox.zip"),
  projectName = "tempasi",
} = {}) {
  const normalizedProject = normalizeProjectName(projectName) || "tempasi";
  const state = await loadPiligrimState();

  const coreDir = resolveProjectPiligrimDir(CORE_PROJECT_NAME);
  const projectDir = resolveProjectPiligrimDir(normalizedProject);

  const corePack = coreDir && await fileExists(coreDir)
    ? await collectFilesRecursive(coreDir)
    : {};

  const projectPack = projectDir && await fileExists(projectDir)
    ? await collectFilesRecursive(projectDir)
    : {};

  const uriCore = projectPack["URI_CORE.md"] || corePack["URI_CORE.md"] || builtInUriCore();
  const projectState = projectPack["PROJECT_STATE.md"] || builtInProjectState(normalizedProject);
  const nextStep = projectPack["NEXT_STEP.md"] || builtInNextStep();
  const projectIndex = projectPack["PROJECT_INDEX.md"] || builtInProjectIndex(normalizedProject);
  const piligrim = projectPack["PILIGRIM.md"] || builtInPiligrim();

  const filesMap = {
    ...projectPack,
    "STATUS.json": JSON.stringify({
      status: "success",
      kind: "handoff",
      project: normalizedProject,
      generated_at: nowIso(),
      piligrim_update_needed: Boolean(state.piligrim_update_needed),
      piligrim_updated: Boolean(state.piligrim_updated),
      piligrim_ready_for_handoff: Boolean(state.piligrim_ready_for_handoff),
    }, null, 2) + "\n",
    "REPORT/HANDOFF_STATUS.md": [
      "# HANDOFF STATUS",
      "",
      `project: ${normalizedProject}`,
      `piligrim_update_needed: ${Boolean(state.piligrim_update_needed)}`,
      `piligrim_updated: ${Boolean(state.piligrim_updated)}`,
      `piligrim_ready_for_handoff: ${Boolean(state.piligrim_ready_for_handoff)}`,
      "",
    ].join("\n"),
    "PILIGRIM_URI_CORE.md": uriCore,
    "PILIGRIM_PROJECT_STATE.md": projectState,
    "PILIGRIM_NEXT_STEP.md": nextStep,
    "PROJECT_INDEX.md": projectIndex,
    "PILIGRIM.md": piligrim,
  };

  return buildZipFromFiles(filesMap, outboxZipPath);
}

module.exports = {
  DEFAULT_STATE_PATH,
  DEFAULT_OPERATION_LIMIT,
  resolveWorkspaceProjectsRoot,
  resolveOutboxDir,
  resolveProjectPiligrimDir,
  normalizeProjectName,
  loadPiligrimState,
  savePiligrimState,
  incrementOperationCount,
  markPiligrimUpdated,
  syncPiligrimConfig,
  createWhoAmIOutbox,
  createInvalidInboxHelpOutbox,
  createHandoffOutbox,
};
