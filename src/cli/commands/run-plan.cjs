"use strict";

const path = require("path");
const fs = require("fs/promises");

const { readPlanFromFile } = require("../../uram/plan-io.cjs");
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

async function updateHistory({
  runtimeRoot,
  projectRoot,
  trace,
  tracePath,
  planFilePath,
}) {
  const historyDir = path.join(runtimeRoot, "history");
  await ensureDir(historyDir);

  const indexPath = path.join(historyDir, "index.json");

  let index = {
    version: 1,
    updatedAt: new Date().toISOString(),
    runs: []
  };

  try {
    const raw = await fs.readFile(indexPath, "utf8");
    const parsed = JSON.parse(raw);

    index = {
      version: Number.isInteger(parsed?.version) ? parsed.version : 1,
      updatedAt: parsed?.updatedAt || new Date().toISOString(),
      runs: Array.isArray(parsed?.runs) ? parsed.runs : []
    };
  } catch {
    // first run
  }

  index.runs = index.runs.filter((item) => item.runId !== trace.runId);

  index.runs.unshift({
    runId: trace.runId,
    createdAt: trace.createdAt,
    goal: trace.goal,
    finalStatus: trace.finalStatus,
    attempts: trace.attempts,
    stepCount: Array.isArray(trace.steps) ? trace.steps.length : 0,
    traceRelPath: path.relative(projectRoot, tracePath).replace(/\\/g, "/"),
    outboxRelPath: null,
    planRelPath: path.relative(process.cwd(), path.resolve(planFilePath)).replace(/\\/g, "/")
  });

  index.updatedAt = new Date().toISOString();

  await fs.writeFile(indexPath, JSON.stringify(index, null, 2));

  return indexPath;
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
  const historyIndexPath = await updateHistory({
    runtimeRoot: runtimePaths.runtimeRoot,
    projectRoot: projectCtx.cwd,
    trace,
    tracePath,
    planFilePath: absolutePlanPath,
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
