'use strict';

// path: src/commands/browser.cjs

const {
  normalizeBrowserRunInput,
} = require('../runtime/browser/normalize-browser-run-input.cjs');

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

function normalizeBrowserCommandOptions(options = {}) {
  return normalizeBrowserRunInput(options);
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
