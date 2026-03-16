"use strict";

const path = require("path");

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

module.exports = {
  buildRuntimePaths,
};
