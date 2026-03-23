"use strict";

// path: src/runtime/browser/normalize-browser-run-input.cjs

const path = require("node:path");

function toPositiveInteger(value, fallback) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Expected a positive integer, got: ${value}`);
  }

  return parsed;
}

function normalizeBrowserRunInput(input = {}) {
  const normalized = {
    host: String(input.host || "127.0.0.1"),
    port: toPositiveInteger(input.port, 9222),
    timeoutMs: toPositiveInteger(input.timeoutMs, 10000),
    artifactsDir: path.resolve(
      input.artifactsDir || path.join("runtime", "browser", "artifacts")
    ),
  };

  if (input.target) {
    normalized.target = String(input.target);
  }

  return normalized;
}

module.exports = {
  normalizeBrowserRunInput,
  toPositiveInteger,
};
