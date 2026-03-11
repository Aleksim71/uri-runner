"use strict";

const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const unzipper = require("unzipper");
const YAML = require("yaml");

const { runAudit } = require("../commands/context/audit.cjs");
const { CommandRegistry } = require("../commands/command-registry.cjs");
const { loadCommands } = require("../commands/load-commands.cjs");
const { parseScenario } = require("./scenario-parser.cjs");
const { executeScenario } = require("./scenario-executor.cjs");
const { resolveProjectContext } = require("./project-resolver.cjs");
const { acquireExecutionLock, releaseExecutionLock } = require("./execution-lock.cjs");
const {
  resolveUramRoot,
  getInboxZipPath,
  getProcessedDir,
  getTmpDir,
  getProjectBoxDir,
  getHistoryDir,
  getLatestOutboxPath,
} = require("./paths.cjs");

function stampBerlin(d = new Date()) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const m = Object.fromEntries(parts.filter((p) => p.type !== "literal").map((p) => [p.type, p.value]));
  return `${m.year}-${m.month}-${m.day}_${m.hour}-${m.minute}-${m.second}`;
}

function isoBerlin() {
  const s = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .format(new Date())
    .replace(" ", "T");

  const tzOffsetMin = -new Date().getTimezoneOffset();
  const sign = tzOffsetMin >= 0 ? "+" : "-";
  const hh = String(Math.floor(Math.abs(tzOffsetMin) / 60)).padStart(2, "0");
  const mm = String(Math.abs(tzOffsetMin) % 60).padStart(2, "0");
  return `${s}${sign}${hh}:${mm}`;
}

function makeRunId() {
  const iso = new Date().toISOString().replace(/[:.]/g, "-");
  const rnd = crypto.randomBytes(3).toString("hex");
  return `${iso}_${rnd}`;
}

function resolveExecutionKind(runbook) {
  if (runbook?.meta?.context_kind) {
    const kind = String(runbook.meta.context_kind).trim();

    if (kind === "executable_context") return "scenario";
    if (kind === "audit_context") return "audit";

    throw new Error(`[uri] unsupported context_kind: ${kind}`);
  }

  if (runbook?.profile) {
    return String(runbook.profile).trim();
  }

  return "scenario";
}

function getProjectName(runbook) {
  if (runbook?.meta?.project) {
    return String(runbook.meta.project).trim();
  }

  if (runbook?.project) {
    return String(runbook.project).trim();
  }

  return "";
}

async function ensureDir(p) {
  await fsp.mkdir(p, { recursive: true });
}

async function readRunbookFromInboxZip(inboxZipPath) {
  const z = fs.createReadStream(inboxZipPath).pipe(unzipper.Parse({ forceStream: true }));

  for await (const entry of z) {
    const name = entry.path.replace(/\\/g, "/");

    if (name === "RUNBOOK.yaml" || name.endsWith("/RUNBOOK.yaml")) {
      const buf = await entry.buffer();
      const txt = buf.toString("utf-8");
      const runbook = YAML.parse(txt);
      return { runbook, raw: txt };
    }

    entry.autodrain();
  }

  return { runbook: null, raw: null };
}

function validateRunbook(runbook) {
  if (!runbook || typeof runbook !== "object") {
    throw new Error("RUNBOOK.yaml is missing or invalid YAML");
  }

  if (runbook.version !== 1) {
    throw new Error("RUNBOOK.yaml: version must be 1");
  }

  const project = getProjectName(runbook);

  if (!project) {
    throw new Error("RUNBOOK.yaml: project must exist (meta.project or project)");
  }

  return runbook;
}

function getScenarioCommandNames(runbook) {
  if (!Array.isArray(runbook.steps) || runbook.steps.length === 0) {
    throw new Error("RUNBOOK.yaml: steps must be a non-empty array for scenario execution");
  }

  const names = runbook.steps
    .map((step) => step && step.command)
    .filter((value) => typeof value === "string" && value.trim())
    .map((value) => value.trim());

  return Array.from(new Set(names));
}

async function appendJsonl(filePath, obj) {
  await fsp.appendFile(filePath, `${JSON.stringify(obj)}\n`, "utf-8");
}

async function atomicCopyToLatest(srcFile, latestPath, runId) {
  const dir = path.dirname(latestPath);
  await ensureDir(dir);

  const tmp = path.join(dir, `.tmp.latest.${runId}.zip`);
  await fsp.copyFile(srcFile, tmp);
  await fsp.rename(tmp, latestPath);
}

async function writeScenarioOutbox(outboxPath, payload) {
  const body = JSON.stringify(payload, null, 2);
  await fsp.writeFile(outboxPath, body, "utf-8");
}

async function runScenarioProfile({ runbook, commandsDir, quiet, cwd }) {
  const commandNames = getScenarioCommandNames(runbook);
  const registry = new CommandRegistry();
  const loaded = loadCommands(commandsDir, registry, { only: commandNames });
  const parsed = parseScenario(runbook);

  if (!quiet) {
    console.log(`[uri] run: scenario commands loaded=${loaded.length}`);
    console.log(`[uri] run: scenario commands=${commandNames.join(", ")}`);
  }

  const result = await executeScenario(parsed, {
    registry,
    context: {
      cwd,
      logger: console,
      state: { steps: {} },
    },
    maxSteps: 100,
  });

  return {
    exitCode: result.ok ? 0 : 1,
    scenarioRes: result,
    loadedCommands: loaded.map((item) => item.name),
  };
}

async function runUramPipeline({ uramCli, workspaceCli, keepWorkspace, verbose, quiet, env, homeDir }) {
  const uramRoot = resolveUramRoot({ cliUram: uramCli, env, homeDir });

  const inboxZipPath = getInboxZipPath(uramRoot);
  const processedDir = getProcessedDir(uramRoot);
  const workspaceRoot = workspaceCli ? path.resolve(workspaceCli) : getTmpDir(uramRoot);

  const startedAt = Date.now();
  const runId = makeRunId();

  if (verbose && !quiet) console.log(`[uri] run: uramRoot=${uramRoot}`);
  if (verbose && !quiet) console.log(`[uri] run: inbox=${inboxZipPath}`);

  try {
    await fsp.access(inboxZipPath, fs.constants.R_OK);
  } catch {
    if (!quiet) console.error(`[uri] run: inbox not found: ${inboxZipPath}`);
    return { exitCode: 10 };
  }

  const { runbook } = await readRunbookFromInboxZip(inboxZipPath);

  if (!runbook) {
    if (!quiet) console.error("[uri] run: RUNBOOK.yaml missing in inbox.zip");
    return { exitCode: 11 };
  }

  const rb = validateRunbook(runbook);
  const project = getProjectName(rb);
  const executionKind = resolveExecutionKind(rb);

  const projectCtx = await resolveProjectContext({
    uramRoot,
    project,
  });

  const projectBoxDir = getProjectBoxDir(uramRoot, project);
  const historyDir = getHistoryDir(projectBoxDir);
  const latestOutboxPath = getLatestOutboxPath(projectBoxDir);

  await ensureDir(projectBoxDir);
  await ensureDir(historyDir);
  await ensureDir(processedDir);
  await ensureDir(workspaceRoot);

  const stamp = stampBerlin();
  const tmpOutboxPath = path.join(projectBoxDir, `.tmp.outbox.${runId}.zip`);

  let exitCode = 2;
  let auditRes = null;
  let scenarioRes = null;
  let loadedCommands = [];
  let lock = null;

  const prevCwd = process.cwd();

  try {
    lock = await acquireExecutionLock({
      uramRoot,
      project,
      runId,
    });

    process.chdir(projectCtx.cwd);

    if (!quiet) {
      console.log(`[uri] run: project=${project}, engine=${executionKind}, cwd=${projectCtx.cwd}`);
      console.log(`[uri] run: lock=${lock.lockPath}`);
    }

    if (executionKind === "audit") {
      auditRes = await runAudit({
        cwd: projectCtx.cwd,
        inboxPath: inboxZipPath,
        outboxPath: tmpOutboxPath,
        workspaceDir: workspaceRoot,
      });

      exitCode = auditRes.exitCode;
    } else if (executionKind === "scenario") {
      const commandsDir = path.resolve(__dirname, "../commands");

      const scenarioRun = await runScenarioProfile({
        runbook: rb,
        commandsDir,
        quiet,
        cwd: projectCtx.cwd,
      });

      exitCode = scenarioRun.exitCode;
      scenarioRes = scenarioRun.scenarioRes;
      loadedCommands = scenarioRun.loadedCommands;

      await writeScenarioOutbox(tmpOutboxPath, {
        ok: scenarioRes.ok,
        engine: "scenario",
        project,
        cwd: projectCtx.cwd,
        loaded_commands: loadedCommands,
        result: scenarioRes,
      });
    } else {
      if (!quiet) {
        console.error(`[uri] run: unsupported engine: ${executionKind}`);
      }

      return { exitCode: 2 };
    }
  } finally {
    process.chdir(prevCwd);
    await releaseExecutionLock(lock?.lockPath);
  }

  const ok = exitCode === 0;
  const statusText = ok ? "OK" : "FAIL";

  await fsp.access(tmpOutboxPath, fs.constants.R_OK);

  const historyOutboxName = `${stamp}__${executionKind}__${statusText}__${runId}.outbox.zip`;
  const historyOutboxPath = path.join(historyDir, historyOutboxName);

  await fsp.rename(tmpOutboxPath, historyOutboxPath);
  await atomicCopyToLatest(historyOutboxPath, latestOutboxPath, runId);

  const durationMs = Date.now() - startedAt;
  const indexPath = path.join(historyDir, "index.jsonl");

  await appendJsonl(indexPath, {
    ts: isoBerlin(),
    run_id: runId,
    project,
    engine: executionKind,
    ok,
    exit_code: exitCode,
    duration_ms: durationMs,
    cwd: projectCtx.cwd,
    inbox_name: path.basename(inboxZipPath),
    outbox_rel_path: path.join("history", historyOutboxName),
    loaded_commands: loadedCommands,
  });

  const processedInboxName = `${stamp}__${project}__${runId}.inbox.zip`;
  const processedInboxPath = path.join(processedDir, processedInboxName);

  await fsp.rename(inboxZipPath, processedInboxPath);

  void keepWorkspace;

  if (!quiet) {
    console.log(`[uri] run: exitCode=${exitCode}`);
    console.log(`[uri] run: latest=${latestOutboxPath}`);
    console.log(`[uri] run: history=${historyOutboxPath}`);
    console.log(`[uri] run: inbox processed=${processedInboxPath}`);
  }

  return {
    exitCode,
    auditRes,
    scenarioRes,
    loadedCommands,
    projectCtx,
  };
}

module.exports = { runUramPipeline };
