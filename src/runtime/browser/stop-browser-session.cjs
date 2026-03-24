// path: src/runtime/browser/stop-browser-session.cjs
'use strict';

const {
  getBrowserSessionState,
  clearBrowserSessionState
} = require('./browser-session-store.cjs');

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function stopBrowserSession(options) {
  if (!options || typeof options !== 'object') {
    throw new Error('stopBrowserSession options must be an object.');
  }

  const runtimeContext = options.runtimeContext;
  const sessionId = options.sessionId;

  if (!runtimeContext || typeof runtimeContext !== 'object') {
    throw new Error('stopBrowserSession runtimeContext is required.');
  }

  if (!isNonEmptyString(sessionId)) {
    throw new Error('stopBrowserSession sessionId is required.');
  }

  const existing = getBrowserSessionState(runtimeContext, sessionId);
  const stoppedAt = new Date().toISOString();

  clearBrowserSessionState(runtimeContext, sessionId);

  return {
    ok: true,
    sessionId: existing.sessionId,
    target: existing.target,
    pageUrl: existing.pageUrl,
    stoppedAt
  };
}

module.exports = {
  stopBrowserSession
};
