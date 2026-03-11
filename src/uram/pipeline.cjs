"use strict";

const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const unzipper = require("unzipper");
const YAML = require("yaml");
const crypto = require("crypto");

const { resolveProjectContext } = require("./project-resolver.cjs");
const { withExecutionLock } = require("./execution-lock.cjs");

const { runScenarioEngine } = require("./engines/scenario-engine.cjs");
const { runAuditEngine } = require("./engines/audit-engine.cjs");

const { finalizeRun } = require("./finalize-run.cjs");

const {
  resolveUramRoot,
  getInboxZipPath,
  getProcessedDir,
  getTmpDir,
  getProjectBoxDir,
  getHistoryDir,
  getLatestOutboxPath,
} = require("./paths.cjs");

function makeRunId() {
  const iso = new Date().toISOString().replace(/[:.]/g, "-");
  const rnd = crypto.randomBytes(3).toString("hex");
  return `${iso}_${rnd}`;
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

  if (!runbook.project && !runbook?.meta?.project) {
    throw new Error("RUNBOOK.yaml: project must exist");
  }

  return runbook;
}

function resolveExecutionKind(runbook) {
  if (runbook?.meta?.context_kind === "audit_context") return "audit";
  return "scenario";
}

async function runUramPipeline({ uramCli, workspaceCli, quiet, env, homeDir }) {
  const uramRoot = resolveUramRoot({ cliUram: uramCli, env, homeDir });

  const inboxZipPath = getInboxZipPath(uramRoot);
  const processedDir = getProcessedDir(uramRoot);
  const workspaceRoot = workspaceCli ? path.resolve(workspaceCli) : getTmpDir(uramRoot);

  const startedAt = Date.now();
  const runId = makeRunId();

  const { runbook } = await readRunbookFromInboxZip(inboxZipPath);

  const rb = validateRunbook(runbook);
  const project = rb.meta?.project || rb.project;

  const executionKind = resolveExecutionKind(rb);

  const projectCtx = await resolveProjectContext({
    uramRoot,
    project,
  });

  const projectBoxDir = getProjectBoxDir(uramRoot, project);
  const historyDir = getHistoryDir(projectBoxDir);
  const latestOutboxPath = getLatestOutboxPath(projectBoxDir);

  await fsp.mkdir(projectBoxDir, { recursive: true });
  await fsp.mkdir(historyDir, { recursive: true });
  await fsp.mkdir(processedDir, { recursive: true });
  await fsp.mkdir(workspaceRoot, { recursive: true });

  const tmpOutboxPath = path.join(projectBoxDir, `.tmp.outbox.${runId}.zip`);

  const engines = {
    scenario: runScenarioEngine,
    audit: runAuditEngine,
  };

  const engine = engines[executionKind];

  const engineResult = await withExecutionLock(
    { uramRoot, project, runId },
    async () => {
      process.chdir(projectCtx.cwd);

      return await engine({
        runbook: rb,
        project,
        projectCtx,
        inboxZipPath,
        tmpOutboxPath,
        workspaceRoot,
        quiet,
      });
    }
  );

  if (engineResult.outboxPayload) {
    await fsp.writeFile(
      tmpOutboxPath,
      JSON.stringify(engineResult.outboxPayload, null, 2),
      "utf-8"
    );
  }

  await finalizeRun({
    tmpOutboxPath,
    latestOutboxPath,
    historyDir,
    inboxZipPath,
    processedDir,
    stamp: new Date().toISOString(),
    runId,
    project,
    executionKind,
    exitCode: engineResult.exitCode,
    startedAt,
    loadedCommands: engineResult.meta.loadedCommands || [],
    cwd: projectCtx.cwd,
    quiet,
  });

  return {
    exitCode: engineResult.exitCode,
    ...engineResult.meta,
  };
}

module.exports = { runUramPipeline };
