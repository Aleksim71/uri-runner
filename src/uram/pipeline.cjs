"use strict";

const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const { resolveProjectContext } = require("./project-resolver.cjs");
const { withExecutionLock } = require("./execution-lock.cjs");

const { runScenarioEngine } = require("./engines/scenario-engine.cjs");
const { runAuditEngine } = require("./engines/audit-engine.cjs");

const { finalizeRun } = require("./finalize-run.cjs");

const {
  readRunbookFromInboxZip,
  validateRunbook,
  resolveExecutionKind,
  getProjectName,
} = require("./runbook.cjs");

const { loadExecutableContext } = require("./executable-context.cjs");

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

async function ensureDir(p) {
  await fsp.mkdir(p, { recursive: true });
}

async function runUramPipeline({ uramCli, workspaceCli, quiet, env, homeDir }) {
  const uramRoot = resolveUramRoot({ cliUram: uramCli, env, homeDir });

  const inboxZipPath = getInboxZipPath(uramRoot);
  const processedDir = getProcessedDir(uramRoot);
  const workspaceRoot = workspaceCli
    ? path.resolve(workspaceCli)
    : getTmpDir(uramRoot);

  const startedAt = Date.now();
  const runId = makeRunId();

  const { runbook } = await readRunbookFromInboxZip(inboxZipPath);

  const rb = validateRunbook(runbook);
  const project = getProjectName(rb);

  const executionKind = resolveExecutionKind(rb);

  const projectCtx = await resolveProjectContext({
    uramRoot,
    project,
  });

  const executableCtx = await loadExecutableContext(projectCtx);

  const projectBoxDir = getProjectBoxDir(uramRoot, project);
  const historyDir = getHistoryDir(projectBoxDir);
  const latestOutboxPath = getLatestOutboxPath(projectBoxDir);

  await ensureDir(projectBoxDir);
  await ensureDir(historyDir);
  await ensureDir(processedDir);
  await ensureDir(workspaceRoot);

  const tmpOutboxPath = path.join(projectBoxDir, `.tmp.outbox.${runId}.zip`);

  const engines = {
    scenario: runScenarioEngine,
    audit: runAuditEngine,
  };

  const engine = engines[executionKind];

  if (!engine) {
    throw new Error(`[uri] unsupported engine: ${executionKind}`);
  }

  const engineResult = await withExecutionLock(
    { uramRoot, project, runId },
    async () => {
      process.chdir(projectCtx.cwd);

      if (!quiet) {
        console.log(
          `[uri] run: project=${project}, engine=${executionKind}, cwd=${projectCtx.cwd}`
        );
      }

      return await engine({
        runbook: rb,
        project,
        projectCtx,
        executableCtx,
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
    executableCtx,
    ...engineResult.meta,
  };
}

module.exports = { runUramPipeline };
