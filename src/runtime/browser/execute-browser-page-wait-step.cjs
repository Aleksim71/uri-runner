// path: src/runtime/browser/execute-browser-page-wait-step.cjs
'use strict';

const {
  waitBrowserPageReady
} = require('./wait-browser-page-ready.cjs');

function executeBrowserPageWaitStep(options) {
  if (!options || typeof options !== 'object') {
    throw new Error('executeBrowserPageWaitStep options must be an object.');
  }

  const runtimeContext = options.runtimeContext;
  if (!runtimeContext || typeof runtimeContext !== 'object') {
    throw new Error('executeBrowserPageWaitStep runtimeContext is required.');
  }

  const result = waitBrowserPageReady({
    runtimeContext,
    sessionId: options.sessionId,
    strategy: options.strategy,
    waitedMs: options.waitedMs
  });

  return {
    ok: true,
    stepType: 'browser.page.wait',
    sessionId: result.sessionId,
    target: result.target,
    pageUrl: result.pageUrl,
    ready: result.ready,
    strategy: result.strategy,
    waitedMs: result.waitedMs,
    readyAt: result.readyAt
  };
}

module.exports = {
  executeBrowserPageWaitStep
};
