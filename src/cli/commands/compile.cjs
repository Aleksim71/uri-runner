"use strict";

const fs = require("fs/promises");
const path = require("path");

const { readRunbookFromInboxZip } = require("../../uram/runbook.cjs");
const { resolveProjectContext } = require("../../uram/project-resolver.cjs");
const { loadExecutableContext } = require("../../uram/executable-context.cjs");
const { compilePlan } = require("../../uram/compile-plan.cjs");
const { compileRunbookObject } = require("../../runtime/compile-runbook.cjs");

function isMaterializedRunbook(runbook) {
  return (
    runbook &&
    runbook.receiver === "uri" &&
    (
      Array.isArray(runbook.provide) ||
      Array.isArray(runbook.modify) ||
      Array.isArray(runbook.goal_checks)
    )
  );
}

async function compileInboxToPlan(input, maybeOutputPlanPath) {
  let inboxZipPath;
  let outputPlanPath;
  let uramRoot = process.cwd();

  if (input && typeof input === "object" && !Array.isArray(input)) {
    inboxZipPath = input.inboxZipPath;
    outputPlanPath = input.outputPlanPath;
    uramRoot = input.uramRoot || uramRoot;
  } else {
    inboxZipPath = input;
    outputPlanPath = maybeOutputPlanPath;
  }

  if (!inboxZipPath || !outputPlanPath) {
    throw new Error("compile requires <inbox.zip> <output-plan.json>");
  }

  const { runbook } = await readRunbookFromInboxZip(inboxZipPath);

  const project = runbook?.project;
  if (!project) {
    throw new Error("[uri] runbook missing project field");
  }

  let plan;

  if (isMaterializedRunbook(runbook)) {
    plan = compileRunbookObject(runbook, { source: "RUNBOOK.yaml" });
  } else {
    const projectCtx = await resolveProjectContext({
      uramRoot,
      project,
      cwd: path.dirname(path.resolve(inboxZipPath)),
    });

    let executableCtx = null;

    try {
      executableCtx = await loadExecutableContext(projectCtx);
    } catch {
      executableCtx = null;
    }

    plan = compilePlan({
      runbook,
      project,
      executionKind: "scenario",
      executableCtx,
    });
  }

  const absOutputPath = path.resolve(outputPlanPath);
  await fs.mkdir(path.dirname(absOutputPath), { recursive: true });
  const payload = JSON.stringify(plan, null, 2);
  await fs.writeFile(absOutputPath, payload, "utf8");

  const bytes = Buffer.byteLength(payload, "utf8");

  console.log(`[uri] plan written: ${absOutputPath}`);
  console.log(`[uri] bytes: ${bytes}`);

  return {
    ok: true,
    project,
    planPath: absOutputPath,
    bytes,
  };
}

module.exports = compileInboxToPlan;
module.exports.compileInboxToPlan = compileInboxToPlan;
