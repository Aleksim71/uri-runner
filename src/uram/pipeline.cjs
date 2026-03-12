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

const { ERROR_CODES, isKnownErrorCode } = require("./error-codes.cjs");

class UramRuntimeError extends Error {
  constructor(message, code = ERROR_CODES.PIPELINE_INTERNAL_ERROR, details = {}) {
    super(message);
    this.name = "UramRuntimeError";
    this.code = code;
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

function normalizeEngineError(err, fallbackEngine) {
  const message = pickErrorMessage(err);
  const code = pickErrorCode(err);
  const details = pickErrorDetails(err);
  const name = pickErrorName(err);

  return {
    exitCode: 1,
    engine: fallbackEngine || "unknown",
    outboxPayload: {
      ok: false,
      engine: fallbackEngine || "unknown",
      error: {
        name,
        code,
        message,
        details,
      },
    },
    meta: {
      loadedCommands: [],
      error: {
        name,
        code,
        message,
        details,
      },
    },
  };
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

    tmpOutboxPath = path.join(projectBoxDir, `.tmp.outbox.${runId}.zip`);

    const engines = {
      scenario: runScenarioEngine,
      audit: runAuditEngine,
    };

    const engine = engines[executionKind];

    if (!engine) {
      throw new UramRuntimeError(
        `[uri] unsupported engine: ${executionKind}`,
        ERROR_CODES.ENGINE_NOT_ALLOWED,
        { executionKind }
      );
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
          projectRoot: projectCtx.cwd,
          inboxZipPath,
          tmpOutboxPath,
          workspaceRoot,
          workspaceDir: workspaceRoot,
          quiet,
          runId,
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
      loadedCommands: engineResult.meta?.loadedCommands || [],
      cwd: projectCtx.cwd,
      quiet,
    });

    return {
      runId,
      project,
      engine: executionKind,
      exitCode: engineResult.exitCode,
      ok: engineResult.exitCode === 0,
      executableCtx,
      ...(engineResult.meta || {}),
    };
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
          tmpOutboxPath || path.join(projectBoxDir, `.tmp.outbox.${runId}.zip`);

        await fsp.writeFile(
          tmpOutboxPath,
          JSON.stringify(normalizedResult.outboxPayload, null, 2),
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

    return {
      runId,
      project,
      engine: executionKind,
      exitCode: normalizedResult.exitCode,
      ok: false,
      executableCtx,
      ...(normalizedResult.meta || {}),
    };
  }
}

module.exports = {
  runUramPipeline,
  UramRuntimeError,
};
