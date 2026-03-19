// path: src/runtime/result-builder.cjs
"use strict";

function buildRuntimeResult(input = {}) {
  const ok = input.ok === true || resolveExitCode(input) === 0;
  const exitCode = resolveExitCode({
    ok,
    exitCode: input.exitCode,
    error: input.error,
  });
  const outboxPayload = normalizePlainObject(input.outboxPayload);
  const meta = normalizeMeta(input.meta);
  const fileDeliveryReport = normalizeFileDeliveryReport(
    input.fileDeliveryReport ?? meta.fileDeliveryReport ?? outboxPayload.fileDeliveryReport ?? null
  );

  return {
    runId: normalizeString(input.runId),
    project: normalizeString(input.project),
    engine: normalizeString(input.engine),
    ok,
    exitCode,
    attempts: normalizeAttempts(input.attempts),
    executableCtx: input.executableCtx ?? null,
    loadedCommands: normalizeLoadedCommands(
      input.loadedCommands ?? input.meta?.loadedCommands
    ),
    error: normalizeRuntimeError(input.error ?? input.meta?.error ?? null),
    meta,
    outboxPayload,
    fileDeliveryReport,
  };
}

function buildSuccessResult(input = {}) {
  return buildRuntimeResult({
    ...input,
    ok: true,
    exitCode: Number.isInteger(input.exitCode) ? input.exitCode : 0,
    error: null,
  });
}

function buildFailureResult(input = {}, error = null) {
  const normalizedInput =
    isPlainObject(input) && !Array.isArray(input)
      ? { ...input, error: error ?? input.error ?? null }
      : { runId: input, error };

  return buildRuntimeResult({
    ...normalizedInput,
    ok: false,
    exitCode:
      Number.isInteger(normalizedInput.exitCode) && normalizedInput.exitCode >= 0
        ? normalizedInput.exitCode
        : 1,
  });
}

function resolveExitCode(input = {}) {
  if (Number.isInteger(input.exitCode) && input.exitCode >= 0) {
    return input.exitCode;
  }

  if (input.ok === true) {
    return 0;
  }

  if (input.error) {
    return 1;
  }

  return 0;
}

function normalizeRuntimeError(error) {
  if (!error) {
    return null;
  }

  if (typeof error !== "object" || Array.isArray(error)) {
    return {
      name: "Error",
      code: "UNKNOWN_ERROR",
      message: String(error),
      details: {},
    };
  }

  return {
    name:
      typeof error.name === "string" && error.name.trim()
        ? error.name.trim()
        : "Error",
    code:
      typeof error.code === "string" && error.code.trim()
        ? error.code.trim()
        : "UNKNOWN_ERROR",
    message:
      typeof error.message === "string" && error.message.trim()
        ? error.message.trim()
        : "Unknown error",
    details: normalizePlainObject(error.details),
  };
}

function normalizeFileDeliveryReport(report) {
  if (!isPlainObject(report)) {
    return null;
  }

  const fileResults = Array.isArray(report.fileResults)
    ? report.fileResults.map(normalizeFileResult)
    : [];

  return {
    ok: report.ok === true,
    error: normalizeRuntimeError(report.error),
    summary: normalizeSummary(report.summary),
    requestedFiles: normalizeStringArray(report.requestedFiles),
    providedFiles: normalizeStringArray(report.providedFiles),
    fileResults,
    projectTree: normalizeProjectTree(report.projectTree),
  };
}

function normalizeFileResult(item) {
  const source = isPlainObject(item) ? { ...item } : {};
  const normalized = {
    requestedPath: normalizeString(source.requestedPath) || "[unknown]",
    status: normalizeFileStatus(source.status),
    providedPath: normalizeString(source.providedPath),
    error: normalizeRuntimeError(source.error),
  };

  if (typeof source.kind === "string" && source.kind.trim()) {
    normalized.kind = source.kind.trim();
  }

  if (Array.isArray(source.lines)) {
    normalized.lines = source.lines.filter(Number.isInteger);
  }

  if (typeof source.source === "string" && source.source.trim()) {
    normalized.source = source.source.trim();
  }

  return normalized;
}

function normalizeFileStatus(status) {
  return status === "provided" || status === "missing" || status === "failed"
    ? status
    : "failed";
}

function normalizeSummary(summary) {
  const source = isPlainObject(summary) ? summary : {};
  return {
    requested: normalizeCounter(source.requested),
    provided: normalizeCounter(source.provided),
    missing: normalizeCounter(source.missing),
    failed: normalizeCounter(source.failed),
  };
}

function normalizeCounter(value) {
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

function normalizeProjectTree(projectTree) {
  const source = isPlainObject(projectTree) ? projectTree : {};
  return {
    attached: source.attached === true,
    path: normalizeString(source.path),
  };
}

function normalizeMeta(meta) {
  const source = normalizePlainObject(meta);
  const normalized = { ...source };

  normalized.loadedCommands = normalizeLoadedCommands(source.loadedCommands);

  if ("error" in source) {
    normalized.error = normalizeRuntimeError(source.error);
  }

  if (!isPlainObject(normalized.plan)) {
    delete normalized.plan;
  }

  if (
    typeof normalized.tmpProvidedDir !== "string" &&
    normalized.tmpProvidedDir !== null
  ) {
    delete normalized.tmpProvidedDir;
  }

  if ("fileDeliveryReport" in source) {
    normalized.fileDeliveryReport = normalizeFileDeliveryReport(
      source.fileDeliveryReport
    );
  }

  return normalized;
}

function normalizeLoadedCommands(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => normalizeString(item)).filter(Boolean);
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => normalizeString(item)).filter(Boolean);
}

function normalizeAttempts(value) {
  if (!Number.isInteger(value) || value < 1) {
    return 1;
  }

  return value;
}

function normalizePlainObject(value) {
  if (!isPlainObject(value)) {
    return {};
  }

  return { ...value };
}

function normalizeString(value) {
  if (value == null) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized === "" ? null : normalized;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

module.exports = {
  buildRuntimeResult,
  buildSuccessResult,
  buildFailureResult,
  resolveExitCode,
  normalizeRuntimeError,
  normalizeFileDeliveryReport,
};
