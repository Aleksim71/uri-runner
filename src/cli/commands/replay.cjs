"use strict";

const fs = require("fs/promises");
const path = require("path");

const {
  readHistoryIndex,
} = require("../../runtime/history/read-history-index.cjs");

const {
  listTraceHistory,
} = require("../../runtime/list-trace-history.cjs");

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function findTraceByRunId(runId, project) {
  const projectRoot = resolveProjectRoot(project);

  const fromHistory = await findTracePathInHistoryIndex({
    runId,
    projectRoot,
  });

  if (fromHistory) {
    return fromHistory;
  }

  const fromScan = await findTracePathByScan({
    runId,
    projectRoot,
  });

  if (fromScan) {
    return fromScan;
  }

  throw new Error(`trace not found for runId: ${runId}`);
}

async function findTracePathInHistoryIndex({ runId, projectRoot }) {
  try {
    const historyIndexPath = path.join(
      projectRoot,
      "runtime",
      "history",
      "index.json"
    );

    const { exists, index } = await readHistoryIndex({
      historyIndexPath,
    });

    if (!exists || !Array.isArray(index.runs)) {
      return null;
    }

    const entry = index.runs.find((item) => item.runId === runId);

    if (!entry || !entry.traceRelPath) {
      return null;
    }

    return path.resolve(projectRoot, entry.traceRelPath);
  } catch {
    return null;
  }
}

async function findTracePathByScan({ runId, projectRoot }) {
  try {
    const runs = await listTraceHistory({ projectRoot });
    const entry = runs.find((item) => item.runId === runId);

    if (!entry || !entry.traceRelPath) {
      return null;
    }

    return path.resolve(projectRoot, entry.traceRelPath);
  } catch {
    return null;
  }
}

function resolveProjectRoot(project) {
  if (typeof project === "string" && project.trim() !== "") {
    return path.resolve(process.cwd(), project);
  }

  return process.cwd();
}

async function runReplayCommand(args = []) {
  const [traceFileOrRunId, project] = args;

  if (!traceFileOrRunId) {
    throw new Error("replay requires <trace-file|runId> [project]");
  }

  const tracePath = traceFileOrRunId.endsWith(".json")
    ? path.resolve(traceFileOrRunId)
    : await findTraceByRunId(traceFileOrRunId, project);

  const trace = await readJson(tracePath);

  const lines = [];
  lines.push("URI REPLAY");
  lines.push("────────────────────────");
  lines.push(`runId: ${trace.runId}`);
  lines.push(`goal: ${trace.goal}`);
  lines.push(`status: ${trace.finalStatus}`);
  lines.push(`steps: ${Array.isArray(trace.steps) ? trace.steps.length : 0}`);
  lines.push(`trace: ${path.relative(process.cwd(), tracePath).replace(/\\/g, "/")}`);

  process.stdout.write(`${lines.join("\n")}\n`);

  return {
    ok: true,
    tracePath,
    trace,
  };
}

module.exports = {
  runReplayCommand,
};
