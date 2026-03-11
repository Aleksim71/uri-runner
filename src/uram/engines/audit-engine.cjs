"use strict";

const { runAudit } = require("../../commands/context/audit.cjs");

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

  return {
    exitCode: auditRes.exitCode,
    engine: "audit",
    outboxPayload: null,
    meta: {
      auditRes,
      loadedCommands: [],
    },
  };
}

module.exports = { runAuditEngine };
