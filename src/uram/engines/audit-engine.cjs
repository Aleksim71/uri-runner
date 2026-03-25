"use strict";

const { runAudit } = require("../../commands/context/audit.cjs");

function deriveAuditError(auditRes) {
  if (auditRes?.error && typeof auditRes.error === "object") {
    return auditRes.error;
  }

  const lastError =
    Array.isArray(auditRes?.status?.errors) && auditRes.status.errors.length > 0
      ? auditRes.status.errors[auditRes.status.errors.length - 1]
      : null;

  if (lastError) {
    return {
      name: "AuditError",
      code: lastError.code || "UNKNOWN",
      message: lastError.message || "Audit failed",
      details: {},
    };
  }

  if (auditRes?.exitCode && auditRes.exitCode !== 0) {
    return {
      name: "AuditError",
      code: "AUDIT_FAILED",
      message: `Audit failed with exitCode=${auditRes.exitCode}`,
      details: {},
    };
  }

  return null;
}

async function runAuditEngine({
  projectCtx,
  inboxZipPath,
  tmpOutboxPath,
  workspaceRoot,
}) {
  const auditRes = await runAudit({
    cwd: projectCtx.cwd,
    inboxPath: inboxZipPath,
    outboxPath: tmpOutboxPath,
    workspaceDir: workspaceRoot,
  });

  const derivedError = deriveAuditError(auditRes);

  const outboxPayload = {
    status: auditRes.exitCode === 0 ? "success" : "error",
    attempts: 1,
  };

  if (auditRes?.status && typeof auditRes.status === "object") {
    outboxPayload.audit = auditRes.status;
  }

  if (derivedError) {
    outboxPayload.error = derivedError;
  }

  return {
    exitCode: auditRes.exitCode,
    engine: "audit",
    outboxPayload,
    meta: {
      auditRes,
      loadedCommands: [],
      error: derivedError,
    },
  };
}

module.exports = { runAuditEngine };
