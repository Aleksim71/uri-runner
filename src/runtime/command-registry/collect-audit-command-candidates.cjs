/* path: src/runtime/command-registry/collect-audit-command-candidates.cjs */
"use strict";

function normalizeString(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function normalizeArgs(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeString(item))
    .filter(Boolean);
}

function normalizeCommand(cmd, args) {
  const normalizedCmd = normalizeString(cmd);
  const normalizedArgs = normalizeArgs(args);

  if (normalizedArgs.length > 0 || !normalizedCmd.includes(" ")) {
    return {
      cmd: normalizedCmd,
      args: normalizedArgs,
    };
  }

  const parts = normalizedCmd.split(/\s+/).filter(Boolean);

  return {
    cmd: parts[0] || "",
    args: parts.slice(1),
  };
}

function collectAuditCommandCandidates(runbook) {
  const audit =
    runbook && runbook.audit && typeof runbook.audit === "object"
      ? runbook.audit
      : {};

  const checks = Array.isArray(audit.checks) ? audit.checks : [];
  const candidates = [];

  checks.forEach((check, index) => {
    const normalized = normalizeCommand(check && check.cmd, check && check.args);

    candidates.push({
      source: `audit.checks[${index}]`,
      kind: "check",
      name: normalizeString(check && check.name) || `check-${index + 1}`,
      cmd: normalized.cmd,
      args: normalized.args,
    });
  });

  if (audit.server && typeof audit.server === "object") {
    const normalized = normalizeCommand(audit.server.cmd, audit.server.args);

    candidates.push({
      source: "audit.server",
      kind: "server",
      name: "audit.server",
      cmd: normalized.cmd,
      args: normalized.args,
      readiness:
        audit.server.readiness && typeof audit.server.readiness === "object"
          ? audit.server.readiness
          : {},
      base_url: normalizeString(audit.server.base_url),
    });
  }

  return candidates.filter((item) => item.cmd);
}

module.exports = {
  collectAuditCommandCandidates,
};
