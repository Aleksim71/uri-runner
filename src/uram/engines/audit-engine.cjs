/* path: src/uram/engines/audit-engine.cjs */
"use strict";

const fsp = require("fs/promises");
const os = require("os");
const path = require("path");
const YAML = require("yaml");

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

function resolveAuditCommandRegistry(executableCtx) {
  const runtime =
    executableCtx && executableCtx.runtime && typeof executableCtx.runtime === "object"
      ? executableCtx.runtime
      : {};

  const registry =
    runtime.command_registry && typeof runtime.command_registry === "object"
      ? runtime.command_registry
      : runtime.commandRegistry && typeof runtime.commandRegistry === "object"
        ? runtime.commandRegistry
        : null;

  if (!registry) {
    return {
      enabled: false,
      registryPath: null,
    };
  }

  return {
    enabled: registry.enabled === true,
    registryPath:
      typeof registry.path === "string" && registry.path.trim()
        ? registry.path.trim()
        : typeof registry.registry_path === "string" && registry.registry_path.trim()
          ? registry.registry_path.trim()
          : null,
  };
}

async function createClassificationRequestTmpProvidedDir(classificationRequest) {
  if (!classificationRequest || typeof classificationRequest !== "object") {
    return null;
  }

  const tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "uri-classification-"));
  const providedDir = path.join(tmpRoot, "provided");

  await fsp.mkdir(providedDir, { recursive: true });
  await fsp.writeFile(
    path.join(providedDir, "classification-request.yaml"),
    YAML.stringify(classificationRequest),
    "utf8"
  );
  await fsp.writeFile(
    path.join(providedDir, "classification-request.json"),
    JSON.stringify(classificationRequest, null, 2) + "\n",
    "utf8"
  );

  return tmpRoot;
}

async function runAuditEngine({
  projectCtx,
  inboxZipPath,
  tmpOutboxPath,
  workspaceRoot,
  executableCtx,
}) {
  const auditRes = await runAudit({
    cwd: projectCtx.cwd,
    inboxPath: inboxZipPath,
    outboxPath: tmpOutboxPath,
    workspaceDir: workspaceRoot,
    commandRegistry: resolveAuditCommandRegistry(executableCtx),
  });

  const derivedError = deriveAuditError(auditRes);
  const classificationRequest =
    auditRes?.classificationRequest ||
    (auditRes?.status?.classification_request &&
    typeof auditRes.status.classification_request === "object"
      ? auditRes.status.classification_request
      : null);

  const tmpProvidedDir = classificationRequest
    ? await createClassificationRequestTmpProvidedDir(classificationRequest)
    : null;

  const outboxPayload = {
    status:
      auditRes?.status?.classification_required === true
        ? "classification_required"
        : auditRes.exitCode === 0
          ? "success"
          : "error",
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
      tmpProvidedDir,
    },
  };
}

module.exports = { runAuditEngine };
