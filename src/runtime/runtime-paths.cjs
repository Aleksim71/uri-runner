"use strict";

const path = require("path");
const fs = require("fs");

/**
 * Runtime path contract
 *
 * Canonical execution sandbox:
 *   runtime/runs/<runId>/
 *     traces/
 *     artifacts/
 *     provided/
 *     logs/
 *     tmp/
 *
 * Shared runtime-level dirs remain available only for:
 * - backward compatibility
 * - legacy trace lookup fallback
 * - shared runtime infrastructure
 *
 * New execution code should prefer run*Dir paths.
 */
function buildRuntimePaths({ projectRoot, runId, workspaceDir }) {
  const runtimeRoot = path.join(projectRoot, "runtime");
  const runsDir = path.join(runtimeRoot, "runs");
  const runDir = path.join(runsDir, runId);

  return {
    runtimeRoot,
    runsDir,
    runDir,

    workspaceDir,

    // shared runtime-level dirs (legacy / compatibility / shared infra)
    tmpDir: path.join(runtimeRoot, "tmp"),
    artifactsDir: path.join(runtimeRoot, "artifacts"),
    tracesDir: path.join(runtimeRoot, "traces"),
    providedDir: path.join(runtimeRoot, "provided"),
    logsDir: path.join(runtimeRoot, "logs"),

    // canonical per-run sandbox dirs
    runTmpDir: path.join(runDir, "tmp"),
    runArtifactsDir: path.join(runDir, "artifacts"),
    runTracesDir: path.join(runDir, "traces"),
    runProvidedDir: path.join(runDir, "provided"),
    runLogsDir: path.join(runDir, "logs"),
  };
}

function ensureRuntimeDirectories(runtimePaths) {
  const dirs = [
    runtimePaths.runtimeRoot,
    runtimePaths.runsDir,
    runtimePaths.runDir,

    // shared dirs (kept for compatibility / shared infra)
    runtimePaths.tmpDir,
    runtimePaths.artifactsDir,
    runtimePaths.tracesDir,
    runtimePaths.providedDir,
    runtimePaths.logsDir,

    // canonical per-run sandbox dirs
    runtimePaths.runTmpDir,
    runtimePaths.runArtifactsDir,
    runtimePaths.runTracesDir,
    runtimePaths.runProvidedDir,
    runtimePaths.runLogsDir,
  ];

  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

module.exports = {
  buildRuntimePaths,
  ensureRuntimeDirectories,
};
