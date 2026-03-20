// path: src/uram/pipeline.cjs
"use strict";

const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { execFileSync } = require("child_process");

const { resolveProjectContext } = require("./project-resolver.cjs");
const { withExecutionLock } = require("./execution-lock.cjs");

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

const { ERROR_CODES, isKnownErrorCode } = require("./error-codes.cjs");
const { compilePlan } = require("./compile-plan.cjs");
const { runPlan } = require("./run-plan.cjs");
const { writePlanToFile } = require("./plan-io.cjs");
const {
  getPlansDir,
  getLatestPlanPath,
  getHistoryPlansDir,
  getHistoryPlanPath,
  getHistoryPlanRelPath,
} = require("./plan-paths.cjs");
const {
  getResultPath,
  getRollbackResultPath,
  getBaselineVerifyResultPath,
} = require("./run-paths.cjs");
const { nowIso, serializeError } = require("./artifacts/error-utils.cjs");
const {
  buildResultArtifact,
  persistResultArtifact,
} = require("./artifacts/result-artifact.cjs");
const {
  persistRollbackResultArtifact,
} = require("./artifacts/rollback-result-artifact.cjs");
const {
  persistBaselineVerifyResultArtifact,
} = require("./artifacts/baseline-verify-result-artifact.cjs");
const {
  captureBaseline,
  persistBaselineMeta,
} = require("./state/capture-baseline.cjs");
const { restoreBaselineSafe } = require("./state/restore-baseline.cjs");
const { verifyBaselineSafe } = require("./state/verify-baseline.cjs");
const { finalizeRuntimeSummary } = require("./runtime-summary.cjs");
const { collectProvideOutputs } = require("./provide-output.cjs");
const { buildRuntimeResult } = require("../runtime/result-builder.cjs");
const { toPipelineReturn } = require("../runtime/finalize-run.cjs");

class UramRuntimeError extends Error {
  constructor(message, code = ERROR_CODES.PIPELINE_INTERNAL_ERROR, details = {}) {
    super(message);
    this.name = "UramRuntimeError";
    this.code = code;
    this.details = details;
  }
}

class ScenarioPipelineError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "ScenarioPipelineError";
    this.code = ERROR_CODES.PIPELINE_INTERNAL_ERROR;
    this.details = details;
  }
}

function makeRunId() {
  const iso = new Date().toISOString().replace(/[:.]/g, "-");
  const rnd = crypto.randomBytes(3).toString("hex");
  return `${iso}_${rnd}`;
}

async function ensureDir(p) {
  await fsp.mkdir(p, { recursive: true });
}

function assertEngineAllowed(executionKind, executableCtx) {
  const configuredEngine = executableCtx?.engine;

  if (!configuredEngine) {
    return;
  }

  if (configuredEngine !== executionKind) {
    throw new UramRuntimeError(
      `[uri] engine not allowed by executable context: requested=${executionKind}, configured=${configuredEngine}`,
      ERROR_CODES.ENGINE_NOT_ALLOWED,
      {
        requested: executionKind,
        configured: configuredEngine,
      }
    );
  }
}

function unwrapErrorChain(err) {
  const chain = [];
  const seen = new Set();

  let current = err;

  while (current && typeof current === "object" && !seen.has(current)) {
    chain.push(current);
    seen.add(current);
    current = current.cause;
  }

  return chain;
}

function pickErrorMessage(err) {
  const chain = unwrapErrorChain(err);

  for (const item of chain) {
    if (typeof item.message === "string" && item.message.trim()) {
      return item.message;
    }
  }

  return "[uri] runtime failed with unknown error";
}

function pickErrorName(err) {
  const chain = unwrapErrorChain(err);

  for (const item of chain) {
    if (typeof item.name === "string" && item.name.trim()) {
      return item.name;
    }
  }

  return "Error";
}

function pickErrorDetails(err) {
  const chain = unwrapErrorChain(err);

  for (const item of chain) {
    if (
      item.details &&
      typeof item.details === "object" &&
      !Array.isArray(item.details)
    ) {
      return item.details;
    }
  }

  return {};
}

function pickErrorCode(err) {
  const chain = unwrapErrorChain(err);

  for (const item of chain) {
    if (typeof item.code === "string" && item.code.trim()) {
      const code = item.code.trim();
      if (isKnownErrorCode(code)) {
        return code;
      }
    }
  }

  return ERROR_CODES.PIPELINE_INTERNAL_ERROR;
}

function buildOutboxTrace(err) {
  const details = pickErrorDetails(err);
  const message = pickErrorMessage(err);

  return [
    {
      step:
        typeof details.stepId === "string" && details.stepId.trim()
          ? details.stepId
          : "runtime",
      command:
        typeof details.command === "string" && details.command.trim()
          ? details.command
          : null,
      error: message,
    },
  ];
}

function normalizeEngineError(err, fallbackEngine) {
  const message = pickErrorMessage(err);
  const code = pickErrorCode(err);
  const details = pickErrorDetails(err);
  const name = pickErrorName(err);

  const outboxPayload =
    err && err.outboxPayload && typeof err.outboxPayload === "object"
      ? err.outboxPayload
      : {
          status: "error",
          attempts: 1,
          trace: buildOutboxTrace(err),
        };

  return {
    exitCode: 1,
    engine: fallbackEngine || "unknown",
    outboxPayload,
    meta: {
      loadedCommands: [],
      error: {
        name,
        code,
        message,
        details,
      },
      tmpProvidedDir:
        err && typeof err.tmpProvidedDir === "string" ? err.tmpProvidedDir : null,
      fileDeliveryReport:
        err && err.fileDeliveryReport && typeof err.fileDeliveryReport === "object"
          ? err.fileDeliveryReport
          : null,
    },
  };
}

function buildCanonicalRuntimeOutbox({
  runId,
  project,
  executionKind,
  exitCode,
  executableCtx,
  meta,
  outboxPayload,
}) {
  const payload =
    outboxPayload && typeof outboxPayload === "object"
      ? { ...outboxPayload }
      : {};

  const finalPayload = {
    runId,
    project,
    engine: executionKind,
    exitCode,
    ok: exitCode === 0,
    executableCtx: executableCtx || null,
    loadedCommands: Array.isArray(meta?.loadedCommands) ? meta.loadedCommands : [],
    ...payload,
  };

  if (!("status" in finalPayload)) {
    finalPayload.status = finalPayload.ok ? "success" : "error";
  }

  if (!("attempts" in finalPayload)) {
    finalPayload.attempts = 1;
  }

  if (meta?.error) {
    finalPayload.error = meta.error;
  }

  if (meta?.plan?.path) {
    finalPayload.plan = {
      path: meta.plan.path,
    };
  }

  if (typeof meta?.tmpProvidedDir === "string" || meta?.tmpProvidedDir === null) {
    finalPayload.tmpProvidedDir = meta.tmpProvidedDir ?? null;
  }

  if (meta?.fileDeliveryReport && typeof meta.fileDeliveryReport === "object") {
    finalPayload.fileDeliveryReport = meta.fileDeliveryReport;
  }

  return finalPayload;
}

async function syncOutboxJsonIntoZip({
  zipPath,
  fileDeliveryReport,
  jsonPath = null,
}) {
  if (
    typeof zipPath !== "string" ||
    !zipPath.endsWith(".zip") ||
    !fileDeliveryReport ||
    typeof fileDeliveryReport !== "object"
  ) {
    return;
  }

  const zipAbs = path.resolve(zipPath);

  try {
    await fsp.access(zipAbs);
  } catch {
    return;
  }

  let existingOutbox = {};

  try {
    const raw = execFileSync("unzip", ["-p", zipAbs, "outbox.json"], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    });

    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      existingOutbox = parsed;
    }
  } catch {
    existingOutbox = {};
  }

  const nextOutbox = {
    ...existingOutbox,
    fileDeliveryReport,
  };

  if (typeof jsonPath === "string" && jsonPath.trim()) {
    await fsp.writeFile(
      path.resolve(jsonPath),
      JSON.stringify(nextOutbox, null, 2),
      "utf-8"
    );
  }

  const patchRoot = await fsp.mkdtemp(path.join(path.dirname(zipAbs), ".outbox-sync-"));
  const outboxJsonPath = path.join(patchRoot, "outbox.json");

  try {
    await fsp.writeFile(
      outboxJsonPath,
      JSON.stringify(nextOutbox, null, 2),
      "utf-8"
    );

    try {
      execFileSync("zip", ["-q", "-d", zipAbs, "outbox.json"], {
        stdio: "ignore",
      });
    } catch {
      // ignore when outbox.json does not exist yet inside zip
    }

    execFileSync("zip", ["-q", zipAbs, "outbox.json"], {
      cwd: patchRoot,
      stdio: "ignore",
    });
  } finally {
    await fsp.rm(patchRoot, { recursive: true, force: true });
  }
}

async function syncHistoryOutboxJson({
  historyDir,
  runId,
  fileDeliveryReport,
}) {
  if (typeof historyDir !== "string" || !historyDir.trim()) {
    return;
  }

  let entries = [];
  try {
    entries = await fsp.readdir(historyDir);
  } catch {
    return;
  }

  const candidates = entries
    .filter((name) => name.startsWith(`${runId}__`) && name.endsWith(".outbox.zip"))
    .map((name) => path.join(historyDir, name));

  for (const candidate of candidates) {
    await syncOutboxJsonIntoZip({
      zipPath: candidate,
      fileDeliveryReport,
    });
  }
}

async function persistPlanArtifacts({
  plan,
  projectBoxDir,
  historyDir,
  runId,
}) {
  const plansDir = getPlansDir(projectBoxDir);
  const latestPlanPath = getLatestPlanPath(projectBoxDir);
  const historyPlansDir = getHistoryPlansDir(historyDir);
  const historyPlanPath = getHistoryPlanPath(historyDir, runId);

  await ensureDir(plansDir);
  await ensureDir(historyPlansDir);

  await writePlanToFile(plan, latestPlanPath);
  await writePlanToFile(plan, historyPlanPath);

  return {
    latestPlanPath,
    historyPlanPath,
    planRelPath: getHistoryPlanRelPath(runId),
  };
}

async function persistScenarioResultArtifact({
  historyDir,
  runId,
  startedAt,
  finishedAt,
  executionStatus,
  stepsTotal,
  stepsCompleted,
  failedStep,
  error,
  planWritten = true,
  traceWritten = false,
  artifactsProduced = true,
}) {
  const artifact = buildResultArtifact({
    runId,
    executionStatus,
    startedAt,
    finishedAt,
    stepsTotal,
    stepsCompleted,
    failedStep,
    planWritten,
    traceWritten,
    artifactsProduced,
    error,
  });

  await persistResultArtifact({
    path: getResultPath({ historyDir, runId }),
    artifact,
  });

  return artifact;
}

function extractScenarioPlanRunMeta(engineResult) {
  const planRun = engineResult?.meta?.planRun;

  if (!planRun || typeof planRun !== "object") {
    throw new ScenarioPipelineError(
      "[uri] scenario engine result missing meta.planRun",
      {
        metaKeys: engineResult?.meta ? Object.keys(engineResult.meta) : [],
      }
    );
  }

  return {
    startedAt:
      typeof planRun.startedAt === "string" && planRun.startedAt.trim()
        ? planRun.startedAt
        : null,
    finishedAt:
      typeof planRun.finishedAt === "string" && planRun.finishedAt.trim()
        ? planRun.finishedAt
        : null,
    executionStatus:
      typeof planRun.executionStatus === "string" && planRun.executionStatus.trim()
        ? planRun.executionStatus
        : "success",
    stepsTotal: Number.isInteger(planRun.stepsTotal) ? planRun.stepsTotal : 0,
    stepsCompleted: Number.isInteger(planRun.stepsCompleted)
      ? planRun.stepsCompleted
      : 0,
    failedStep: Number.isInteger(planRun.failedStep) ? planRun.failedStep : null,
  };
}

async function persistScenarioPostExecutionArtifacts({
  historyDir,
  runId,
  pipelineStartedAt,
  resultArtifact,
}) {
  const rollbackResult = await restoreBaselineSafe({ runId });

  await persistRollbackResultArtifact({
    path: getRollbackResultPath({ historyDir, runId }),
    artifact: rollbackResult,
  });

  const baselineVerifyResult = await verifyBaselineSafe({ runId });

  await persistBaselineVerifyResultArtifact({
    path: getBaselineVerifyResultPath({ historyDir, runId }),
    artifact: baselineVerifyResult,
  });

  await finalizeRuntimeSummary({
    historyDir,
    runId,
    startedAt: pipelineStartedAt,
    finishedAt: nowIso(),
    result: resultArtifact,
    rollbackResult,
    baselineVerifyResult,
  });

  return {
    rollbackResult,
    baselineVerifyResult,
  };
}

function buildSuccessOutboxPayload({ provided, fileDeliveryReport = null }) {
  const payload = {
    status: "success",
    attempts: 1,
  };

  if (Array.isArray(provided) && provided.length > 0) {
    payload.provided = provided;
  }

  if (fileDeliveryReport && typeof fileDeliveryReport === "object") {
    payload.fileDeliveryReport = fileDeliveryReport;
  }

  return payload;
}

function buildErrorOutboxPayload({ error, provided, fileDeliveryReport = null }) {
  const payload = {
    status: "error",
    attempts: 1,
    trace: buildOutboxTrace(error),
  };

  if (Array.isArray(provided) && provided.length > 0) {
    payload.provided = provided;
  }

  if (fileDeliveryReport && typeof fileDeliveryReport === "object") {
    payload.fileDeliveryReport = fileDeliveryReport;
  }

  return payload;
}

async function buildProvidedOutputs({
  runbook,
  projectRoot,
  workspaceDir,
  runId,
  tolerateErrors = false,
}) {
  return collectProvideOutputs({
    provide: runbook?.provide || [],
    projectRoot,
    tmpRoot: workspaceDir,
    runId,
    tolerateErrors,
  });
}

async function runScenarioPhases({
  runbook,
  project,
  executableCtx,
  projectRoot,
  projectBoxDir,
  historyDir,
  runId,
  workspaceDir,
}) {
  const pipelineStartedAt = nowIso();

  let planArtifacts = null;

  try {
    const plan = compilePlan({
      runbook,
      project,
      executionKind: "scenario",
      executableCtx,
    });

    planArtifacts = await persistPlanArtifacts({
      plan,
      projectBoxDir,
      historyDir,
      runId,
    });

    const baselineMeta = await captureBaseline({ runId });

    await persistBaselineMeta({
      historyDir,
      runId,
      baselineMeta,
    });

    const engineResult = await runPlan({
      plan,
      projectRoot,
      runId,
      workspaceDir,
    });

    const planRun = extractScenarioPlanRunMeta(engineResult);

    const resultArtifact = await persistScenarioResultArtifact({
      historyDir,
      runId,
      startedAt: planRun.startedAt || pipelineStartedAt,
      finishedAt: planRun.finishedAt || nowIso(),
      executionStatus: planRun.executionStatus || "success",
      stepsTotal: planRun.stepsTotal,
      stepsCompleted: planRun.stepsCompleted,
      failedStep: planRun.failedStep,
      error: null,
      planWritten: true,
      traceWritten: false,
      artifactsProduced: true,
    });

    await persistScenarioPostExecutionArtifacts({
      historyDir,
      runId,
      pipelineStartedAt,
      resultArtifact,
    });

    const { provided, tmpProvidedDir, fileDeliveryReport } = await buildProvidedOutputs({
      runbook,
      projectRoot,
      workspaceDir,
      runId,
      tolerateErrors: false,
    });

    engineResult.meta = engineResult.meta || {};
    engineResult.meta.plan = {
      path: planArtifacts.planRelPath,
    };
    engineResult.meta.tmpProvidedDir = tmpProvidedDir || null;
    engineResult.meta.fileDeliveryReport = fileDeliveryReport || null;
    engineResult.outboxPayload = buildSuccessOutboxPayload({
      provided,
      fileDeliveryReport,
    });

    return engineResult;
  } catch (error) {
    const resultArtifact = await persistScenarioResultArtifact({
      historyDir,
      runId,
      startedAt: pipelineStartedAt,
      finishedAt: nowIso(),
      executionStatus: "crashed",
      stepsTotal: 0,
      stepsCompleted: 0,
      failedStep: null,
      error: serializeError(error),
      planWritten: Boolean(planArtifacts),
      traceWritten: false,
      artifactsProduced: true,
    });

    await persistScenarioPostExecutionArtifacts({
      historyDir,
      runId,
      pipelineStartedAt,
      resultArtifact,
    });

    let provided = [];
    let tmpProvidedDir = null;
    let fileDeliveryReport = null;

    try {
      const collected = await buildProvidedOutputs({
        runbook,
        projectRoot,
        workspaceDir,
        runId,
        tolerateErrors: true,
      });
      provided = collected.provided;
      tmpProvidedDir = collected.tmpProvidedDir;
      fileDeliveryReport = collected.fileDeliveryReport || null;
    } catch {
      // ignore provide failures on error path
    }

    error.outboxPayload = buildErrorOutboxPayload({
      error,
      provided,
      fileDeliveryReport,
    });
    error.tmpProvidedDir = tmpProvidedDir;
    error.fileDeliveryReport = fileDeliveryReport;

    throw error;
  }
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

  let project = "unknown";
  let executionKind = "unknown";
  let projectCtx = null;
  let executableCtx = null;
  let projectBoxDir = null;
  let historyDir = null;
  let latestOutboxPath = null;
  let tmpOutboxPath = null;

  try {
    const { runbook } = await readRunbookFromInboxZip(inboxZipPath);

    const rb = validateRunbook(runbook);
    project = getProjectName(rb);
    executionKind = resolveExecutionKind(rb);

    projectCtx = await resolveProjectContext({
      uramRoot,
      project,
    });

    executableCtx = await loadExecutableContext(projectCtx);

    assertEngineAllowed(executionKind, executableCtx);

    projectBoxDir = getProjectBoxDir(uramRoot, project);
    historyDir = getHistoryDir(projectBoxDir);
    latestOutboxPath = getLatestOutboxPath(projectBoxDir);

    await ensureDir(projectBoxDir);
    await ensureDir(historyDir);
    await ensureDir(processedDir);
    await ensureDir(workspaceRoot);

    tmpOutboxPath = path.join(projectBoxDir, `.tmp.outbox.${runId}.json`);

    const engineResult = await withExecutionLock(
      { uramRoot, project, runId },
      async () => {
        process.chdir(projectCtx.cwd);

        if (!quiet) {
          console.log(
            `[uri] run: project=${project}, engine=${executionKind}, cwd=${projectCtx.cwd}`
          );
        }

        if (executionKind === "scenario") {
          return await runScenarioPhases({
            runbook: rb,
            project,
            executableCtx,
            projectRoot: projectCtx.cwd,
            projectBoxDir,
            historyDir,
            runId,
            workspaceDir: workspaceRoot,
          });
        }

        if (executionKind === "audit") {
          return await runAuditEngine({
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

        throw new UramRuntimeError(
          `[uri] unsupported engine: ${executionKind}`,
          ERROR_CODES.ENGINE_NOT_ALLOWED,
          { executionKind }
        );
      }
    );

    const finalOutboxPayload = buildCanonicalRuntimeOutbox({
      runId,
      project,
      executionKind,
      exitCode: engineResult.exitCode,
      executableCtx,
      meta: engineResult.meta || {},
      outboxPayload: engineResult.outboxPayload || {},
    });

    await fsp.writeFile(
      tmpOutboxPath,
      JSON.stringify(finalOutboxPayload, null, 2),
      "utf-8"
    );

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
      loadedCommands: engineResult.meta?.loadedCommands || [],
      cwd: projectCtx.cwd,
      quiet,
      planRelPath: engineResult.meta?.plan?.path || null,
      tmpProvidedDir: engineResult.meta?.tmpProvidedDir || null,
      projectOutboxDir: projectCtx?.outboxDir || null,
      projectFailedLogsDir: projectCtx?.failedLogsDir || null,
    });

    await syncOutboxJsonIntoZip({
      zipPath: latestOutboxPath,
      fileDeliveryReport: engineResult.meta?.fileDeliveryReport || null,
    });

    if (projectCtx?.outboxDir) {
      await syncOutboxJsonIntoZip({
        zipPath: path.join(projectCtx.outboxDir, "outbox.zip"),
        jsonPath: path.join(projectCtx.outboxDir, "outbox.json"),
        fileDeliveryReport: engineResult.meta?.fileDeliveryReport || null,
      });
    }

    await syncHistoryOutboxJson({
      historyDir,
      runId,
      fileDeliveryReport: engineResult.meta?.fileDeliveryReport || null,
    });

    const runtimeResult = buildRuntimeResult({
      runId,
      project,
      engine: executionKind,
      exitCode: engineResult.exitCode,
      executableCtx,
      loadedCommands: engineResult.meta?.loadedCommands || [],
      meta: engineResult.meta || {},
      outboxPayload: finalOutboxPayload,
    });

    return toPipelineReturn(runtimeResult);
  } catch (err) {
    const normalizedResult = normalizeEngineError(err, executionKind);

    if (project !== "unknown") {
      try {
        projectBoxDir = projectBoxDir || getProjectBoxDir(uramRoot, project);
        historyDir = historyDir || getHistoryDir(projectBoxDir);
        latestOutboxPath =
          latestOutboxPath || getLatestOutboxPath(projectBoxDir);

        await ensureDir(projectBoxDir);
        await ensureDir(historyDir);
        await ensureDir(processedDir);
        await ensureDir(workspaceRoot);

        tmpOutboxPath =
          tmpOutboxPath || path.join(projectBoxDir, `.tmp.outbox.${runId}.json`);

        const finalOutboxPayload = buildCanonicalRuntimeOutbox({
          runId,
          project,
          executionKind,
          exitCode: normalizedResult.exitCode,
          executableCtx,
          meta: normalizedResult.meta || {},
          outboxPayload: normalizedResult.outboxPayload || {},
        });

        await fsp.writeFile(
          tmpOutboxPath,
          JSON.stringify(finalOutboxPayload, null, 2),
          "utf-8"
        );

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
          exitCode: normalizedResult.exitCode,
          startedAt,
          loadedCommands: normalizedResult.meta?.loadedCommands || [],
          cwd: projectCtx?.cwd || workspaceRoot,
          quiet,
          planRelPath: normalizedResult.meta?.plan?.path || null,
          tmpProvidedDir: normalizedResult.meta?.tmpProvidedDir || null,
          projectOutboxDir: projectCtx?.outboxDir || null,
          projectFailedLogsDir: projectCtx?.failedLogsDir || null,
        });

        await syncOutboxJsonIntoZip({
          zipPath: latestOutboxPath,
          fileDeliveryReport: normalizedResult.meta?.fileDeliveryReport || null,
        });

        if (projectCtx?.outboxDir) {
          await syncOutboxJsonIntoZip({
            zipPath: path.join(projectCtx.outboxDir, "outbox.zip"),
            jsonPath: path.join(projectCtx.outboxDir, "outbox.json"),
            fileDeliveryReport: normalizedResult.meta?.fileDeliveryReport || null,
          });
        }

        await syncHistoryOutboxJson({
          historyDir,
          runId,
          fileDeliveryReport: normalizedResult.meta?.fileDeliveryReport || null,
        });
      } catch (finalizeErr) {
        const finalizeMessage =
          finalizeErr?.message || "[uri] finalize failed after runtime error";

        normalizedResult.meta = normalizedResult.meta || {};
        normalizedResult.meta.finalizeError = {
          name: finalizeErr?.name || "Error",
          code:
            typeof finalizeErr?.code === "string" && finalizeErr.code.trim()
              ? finalizeErr.code
              : "FINALIZE_ERROR",
          message: finalizeMessage,
        };
      }
    }

    const runtimeResult = buildRuntimeResult({
      runId,
      project,
      engine: executionKind,
      exitCode: normalizedResult.exitCode,
      executableCtx,
      loadedCommands: normalizedResult.meta?.loadedCommands || [],
      error: normalizedResult.meta?.error || null,
      meta: normalizedResult.meta || {},
      outboxPayload: normalizedResult.outboxPayload || {},
    });

    return toPipelineReturn(runtimeResult);
  }
}

module.exports = {
  runUramPipeline,
  UramRuntimeError,
};
