"use strict";

const fs = require("fs/promises");
const path = require("path");

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function findTraceByRunId(runId, project) {
  const baseDir = project ? path.resolve(process.cwd(), project) : process.cwd();
  const tracePath = path.join(baseDir, "runtime", "traces", `${runId}.trace.json`);
  return tracePath;
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
