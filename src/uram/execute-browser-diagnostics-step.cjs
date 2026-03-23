"use strict";

// path: src/uram/execute-browser-diagnostics-step.cjs

const {
  normalizeBrowserRunInput,
} = require("../runtime/browser/normalize-browser-run-input.cjs");
const {
  runBrowserDiagnostics,
} = require("../runtime/browser/run-browser-diagnostics.cjs");

async function executeBrowserDiagnosticsStep(step, context = {}) {
  const payload =
    step && step.payload && typeof step.payload === "object" ? step.payload : {};

  const runtimeInput = normalizeBrowserRunInput(payload);
  return runBrowserDiagnostics(runtimeInput, context.io || {});
}

module.exports = {
  executeBrowserDiagnosticsStep,
};
