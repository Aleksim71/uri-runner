"use strict";

const fs = require("fs");
const unzipper = require("unzipper");
const YAML = require("yaml");

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

function getProjectName(runbook) {
  if (runbook?.meta?.project) {
    return String(runbook.meta.project).trim();
  }

  if (runbook?.project) {
    return String(runbook.project).trim();
  }

  return "";
}

function resolveExecutionKind(runbook) {
  if (runbook?.meta?.context_kind === "audit_context") return "audit";
  return "scenario";
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
    throw new Error("RUNBOOK.yaml: project must exist");
  }

  return runbook;
}

module.exports = {
  readRunbookFromInboxZip,
  validateRunbook,
  resolveExecutionKind,
  getProjectName,
};
