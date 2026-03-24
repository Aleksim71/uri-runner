// path: src/runtime/browser/execute-browser-diagnostics-collect-step.cjs
'use strict';

const {
  collectBrowserDiagnostics
} = require('./collect-browser-diagnostics.cjs');

async function executeBrowserDiagnosticsCollectStep(options) {
  if (!options || typeof options !== 'object') {
    throw new Error('executeBrowserDiagnosticsCollectStep options must be an object.');
  }

  const runtimeContext = options.runtimeContext;
  if (!runtimeContext || typeof runtimeContext !== 'object') {
    throw new Error('executeBrowserDiagnosticsCollectStep runtimeContext is required.');
  }

  const result = await collectBrowserDiagnostics({
    runtimeContext,
    sessionId: options.sessionId,
    baseDir: options.baseDir,
    consoleEntries: options.consoleEntries,
    networkEntries: options.networkEntries,
    pageTitle: options.pageTitle,
    screenshot: options.screenshot
  });

  return {
    ok: true,
    stepType: 'browser.diagnostics.collect',
    sessionId: result.sessionId,
    target: result.target,
    pageUrl: result.pageUrl,
    diagnosticsAt: result.diagnosticsAt,
    consoleErrorCount: result.consoleErrorCount,
    networkFailureCount: result.networkFailureCount,
    artifacts: result.artifacts
  };
}

module.exports = {
  executeBrowserDiagnosticsCollectStep
};
