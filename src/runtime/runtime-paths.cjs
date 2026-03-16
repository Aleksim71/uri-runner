"use strict";

const path = require("path");
const fs = require("fs");

function buildRuntimePaths({ projectRoot, runId, workspaceDir }) {
  const runtimeRoot = path.join(projectRoot, "runtime");

  return {
    runtimeRoot,
    runsDir: path.join(runtimeRoot, "runs"),
    runDir: path.join(runtimeRoot, "runs", runId),
    workspaceDir,
    tmpDir: path.join(runtimeRoot, "tmp"),
    artifactsDir: path.join(runtimeRoot, "artifacts"),
    tracesDir: path.join(runtimeRoot, "traces"),
    providedDir: path.join(runtimeRoot, "provided"),
    logsDir: path.join(runtimeRoot, "logs"),
  };
}

function ensureRuntimeDirectories(runtimePaths) {
  const dirs = [
    runtimePaths.runtimeRoot,
    runtimePaths.runsDir,
    runtimePaths.runDir,
    runtimePaths.tmpDir,
    runtimePaths.artifactsDir,
    runtimePaths.tracesDir,
    runtimePaths.providedDir,
    runtimePaths.logsDir,
  ];

  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

module.exports = {
  buildRuntimePaths,
  ensureRuntimeDirectories,
};
