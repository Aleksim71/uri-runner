"use strict";

const path = require("path");
const fs = require("fs/promises");

const { readPlanFromFile } = require("../../uram/plan-io.cjs");
const { buildRuntimeResult } = require("../../runtime/result-builder.cjs");
const { appendHistoryEntry } = require("../../runtime/history/append-history-entry.cjs");
const { resolveProjectContext } = require("../../uram/project-resolver.cjs");
const { runPlan } = require("../../uram/run-plan.cjs");
const {
  buildRuntimePaths,
  ensureRuntimeDirectories,
} = require("../../runtime/runtime-paths.cjs");

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

function createRunId() {
  const now = new Date();
  const ts =
    String(now.getUTCFullYear()) +
    pad(now.getUTCMonth() + 1) +
    pad(now.getUTCDate()) +
    pad(now.getUTCHours()) +
    pad(now.getUTCMinutes()) +
    pad(now.getUTCSeconds());

  const rnd = Math.random().toString(36).slice(2, 7);

  return `run_${ts}_${rnd}`;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

function buildTrace({ runId, plan, result }) {
  const startedAt = result?.meta?.planRun?.startedAt || new Date().toISOString();
  const finishedAt = result?.meta?.planRun?.finishedAt || new Date().toISOString();
  const executionStatus = result?.meta?.planRun?.executionStatus || "success";

  const stepResults = Array.isArray(result?.outboxPayload?.result?.results)
    ? result.outboxPayload.result.results
    : [];

  const plannedSteps = Array.isArray(plan?.steps) ? plan.steps : [];

  const steps = plannedSteps.map((step, index) => {
    const matched = stepResults.find((item) => item.stepId === step.stepId);

    return {
      id: step.stepId,
      phase: "scenario",
      index,
      command: step.command,
      message: null,
      result: matched?.ok ? "success" : "unknown",
      details: matched ? JSON.stringify(matched.value ?? null) : null
    };
  });

  return {
    schema: "uri.trace.v1",
    runId,
    createdAt: startedAt,
    finishedAt,
    goal: plan?.goal || "Run compiled scenario plan",
    finalStatus: executionStatus,
    attempts: 1,
    steps
  };
}

async function writeTrace(runtimePaths, trace) {
  await ensureDir(runtimePaths.runTracesDir);

  const tracePath = path.join(runtimePaths.runTracesDir, `${trace.runId}.trace.json`);

  await fs.writeFile(tracePath, JSON.stringify(trace, null, 2));

  return tracePath;
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

  const runId = createRunId();
  const runtimePaths = buildRuntimePaths({
    projectRoot: projectCtx.cwd,
    runId,
    workspaceDir,
  });

  ensureRuntimeDirectories(runtimePaths);

  const result = await withMutedStdout(async () => {
    return runPlan({
      plan,
      projectRoot: projectCtx.cwd,
      runId,
      workspaceDir,
    });
  });

  const trace = buildTrace({
    runId,
    plan,
    result
  });

  const tracePath = await writeTrace(runtimePaths, trace);

  const runtimeResult = buildRuntimeResult({
    runId,
    project,
    engine: result?.outboxPayload?.engine || plan?.engine || "scenario",
    exitCode: result?.exitCode,
    meta: result?.meta || {},
    outboxPayload: result?.outboxPayload || {},
  });

  const historyIndexPath = path.join(runtimePaths.runtimeRoot, "history", "index.json");

  await appendHistoryEntry({
    historyIndexPath,
    trace,
    tracePath,
    planPath: absolutePlanPath,
    projectRoot: projectCtx.cwd,
    result: runtimeResult,
  });

  process.stdout.write(`${JSON.stringify(result.outboxPayload, null, 2)}\n`);

  return {
    ...result,
    tracePath,
    historyIndexPath,
    runId
  };
}

module.exports = {
  runPlanFile,
};
