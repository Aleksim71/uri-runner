"use strict";

const path = require("path");

const { readRunbookFromInboxZip } = require("../../uram/runbook.cjs");
const { resolveProjectContext } = require("../../uram/project-resolver.cjs");
const { loadExecutableContext } = require("../../uram/executable-context.cjs");
const { compilePlan } = require("../../uram/compile-plan.cjs");
const { writePlanToFile } = require("../../uram/plan-io.cjs");

async function compileInboxToPlan({
  uramRoot,
  inboxZipPath,
  outputPlanPath,
}) {
  const { runbook } = await readRunbookFromInboxZip(inboxZipPath);

  const project = runbook?.project;
  if (!project) {
    throw new Error("[uri] runbook missing project field");
  }

  const projectCtx = await resolveProjectContext({
    uramRoot,
    project,
  });

  const executableCtx = await loadExecutableContext(projectCtx);

  const plan = compilePlan({
    runbook,
    project,
    executionKind: "scenario",
    executableCtx,
  });

  const result = await writePlanToFile(plan, path.resolve(outputPlanPath));

  console.log(`[uri] plan written: ${result.path}`);
  console.log(`[uri] bytes: ${result.bytes}`);

  return {
    ok: true,
    project,
    planPath: result.path,
    bytes: result.bytes,
  };
}

module.exports = {
  compileInboxToPlan,
};
