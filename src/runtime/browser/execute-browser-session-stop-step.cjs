// path: src/runtime/browser/execute-browser-session-stop-step.cjs
'use strict';

const {
  stopBrowserSession
} = require('./stop-browser-session.cjs');

function executeBrowserSessionStopStep(options) {
  if (!options || typeof options !== 'object') {
    throw new Error('executeBrowserSessionStopStep options must be an object.');
  }

  const runtimeContext = options.runtimeContext;
  if (!runtimeContext || typeof runtimeContext !== 'object') {
    throw new Error('executeBrowserSessionStopStep runtimeContext is required.');
  }

  const result = stopBrowserSession({
    runtimeContext,
    sessionId: options.sessionId
  });

  return {
    ok: true,
    stepType: 'browser.session.stop',
    sessionId: result.sessionId,
    target: result.target,
    pageUrl: result.pageUrl,
    stoppedAt: result.stoppedAt
  };
}

module.exports = {
  executeBrowserSessionStopStep
};
