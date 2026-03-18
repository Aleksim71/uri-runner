"use strict";

const path = require("path");

const { materializePlanFromRunbook } = require("./materialize-plan.cjs");
const { runPlan } = require("./run-plan.cjs");

async function runFromRunbook(params) {
  const {
    projectRoot,
    runId,
    workspaceDir,
    inboxDir,
  } = params || {};

  if (!projectRoot) {
    throw new Error("run-from-runbook: projectRoot is required");
  }

  if (!runId) {
    throw new Error("run-from-runbook: runId is required");
  }

  if (!workspaceDir) {
    throw new Error("run-from-runbook: workspaceDir is required");
  }

  if (!inboxDir) {
    throw new Error("run-from-runbook: inboxDir is required");
  }

  // 📌 1. materialize plan
  const { plan, planPath } = materializePlanFromRunbook({
    inboxDir,
    artifactsDir: workspaceDir, // ← кладём plan.json в run sandbox
  });

  // 📌 2. execute plan (existing engine)
  const result = await runPlan({
    plan,
    projectRoot,
    runId,
    workspaceDir,
  });

  // 📌 3. enrich meta (important for trace/history)
  return {
    ...result,
    meta: {
      ...(result.meta || {}),
      plan: {
        path: path.relative(projectRoot, planPath),
      },
    },
  };
}

module.exports = {
  runFromRunbook,
};
