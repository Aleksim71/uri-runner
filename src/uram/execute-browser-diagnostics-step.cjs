"use strict";

// path: src/uram/execute-browser-diagnostics-step.cjs

const path = require("node:path");

const {
  normalizeBrowserRunInput,
} = require("../runtime/browser/normalize-browser-run-input.cjs");
const {
  runBrowserDiagnostics,
} = require("../runtime/browser/run-browser-diagnostics.cjs");

function resolveBrowserArtifactsDir(step, context = {}) {
  const payload =
    step && step.payload && typeof step.payload === "object" ? step.payload : {};

  if (typeof payload.artifactsDir === "string" && payload.artifactsDir.trim()) {
    return path.resolve(payload.artifactsDir.trim());
  }

  const baseDir =
    typeof context.workspaceDir === "string" && context.workspaceDir.trim().length > 0
      ? context.workspaceDir
      : context.projectRoot;

  return path.resolve(baseDir || process.cwd(), "REPORT", "browser");
}

async function executeBrowserDiagnosticsStep(step, context = {}) {
  const payload =
    step && step.payload && typeof step.payload === "object" ? step.payload : {};

  const artifactsDir = resolveBrowserArtifactsDir(step, context);
  const runtimeInput = normalizeBrowserRunInput({
    ...payload,
    artifactsDir,
  });

  const result = await runBrowserDiagnostics(runtimeInput, {
    ...(context.io || {}),
    artifactsDir,
  });

  return {
    kind: "browser-step-result",
    status: result && result.status ? result.status : "failed",
    summary:
      result &&
      result.normalizedResult &&
      result.normalizedResult.summary &&
      typeof result.normalizedResult.summary === "object"
        ? result.normalizedResult.summary
        : {},
    artifactsDir,
    reportPath: path.join(artifactsDir, "browser-report.json"),
    writeResult: result && result.writeResult ? result.writeResult : null,
  };
}

module.exports = {
  executeBrowserDiagnosticsStep,
  resolveBrowserArtifactsDir,
};
