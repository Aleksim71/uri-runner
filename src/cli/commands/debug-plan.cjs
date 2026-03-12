"use strict";

const path = require("path");

const { readRunbookFromInboxZip } = require("../../uram/runbook.cjs");
const { resolveProjectContext } = require("../../uram/project-resolver.cjs");
const { loadExecutableContext } = require("../../uram/executable-context.cjs");

const { compilePlan } = require("../../uram/compile-plan.cjs");
const { printPlan } = require("../../uram/plan-debug.cjs");

async function debugPlan({ uramRoot, inboxZipPath }) {
  const { runbook } = await readRunbookFromInboxZip(inboxZipPath);

  const project = runbook.project;

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

  printPlan(plan);
}

module.exports = {
  debugPlan,
};
