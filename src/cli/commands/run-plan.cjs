"use strict";

const path = require("path");

const { readPlanFromFile } = require("../../uram/plan-io.cjs");
const { resolveProjectContext } = require("../../uram/project-resolver.cjs");
const { runPlan } = require("../../uram/run-plan.cjs");

async function withMutedStdout(fn) {
  const originalWrite = process.stdout.write.bind(process.stdout);

  process.stdout.write = function mutedWrite() {
    return true;
  };

  try {
    return await fn();
  } finally {
    process.stdout.write = originalWrite;
  }
}

async function runPlanFile({
  uramRoot,
  planFilePath,
  workspaceDir = null,
}) {
  const absolutePlanPath = path.resolve(planFilePath);
  const plan = await readPlanFromFile(absolutePlanPath);

  const project = plan.project;
  if (!project) {
    throw new Error("[uri] plan missing project field");
  }

  const projectCtx = await resolveProjectContext({
    uramRoot,
    project,
  });

  const result = await withMutedStdout(async () => {
    return runPlan({
      plan,
      projectRoot: projectCtx.cwd,
      runId: `plan-${Date.now()}`,
      workspaceDir,
    });
  });

  process.stdout.write(`${JSON.stringify(result.outboxPayload, null, 2)}\n`);

  return result;
}

module.exports = {
  runPlanFile,
};
