'use strict';

// path: src/commands/browser.cjs

const path = require('node:path');

function getRunBrowserDiagnostics() {
  const runtimeModule = require('../runtime/browser/run-browser-diagnostics.cjs');
  if (typeof runtimeModule === 'function') {
    return runtimeModule;
  }
  if (runtimeModule && typeof runtimeModule.runBrowserDiagnostics === 'function') {
    return runtimeModule.runBrowserDiagnostics;
  }
  throw new Error('run-browser-diagnostics.cjs does not export a runnable browser diagnostics function.');
}

function toPositiveInteger(value, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Expected a positive integer, got: ${value}`);
  }

  return parsed;
}

function normalizeBrowserCommandOptions(options = {}) {
  const normalized = {
    host: String(options.host || '127.0.0.1'),
    port: toPositiveInteger(options.port, 9222),
    timeoutMs: toPositiveInteger(options.timeoutMs, 10000),
    artifactsDir: path.resolve(options.artifactsDir || path.join('runtime', 'browser', 'artifacts')),
  };

  if (options.target) {
    normalized.target = String(options.target);
  }

  return normalized;
}

async function runBrowserCommand(rawOptions = {}) {
  const { json = false } = rawOptions;
  const runtimeOptions = normalizeBrowserCommandOptions(rawOptions);
  const runBrowserDiagnostics = getRunBrowserDiagnostics();
  const result = await runBrowserDiagnostics(runtimeOptions);

  if (json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  }

  return result;
}

module.exports = {
  normalizeBrowserCommandOptions,
  runBrowserCommand,
};
