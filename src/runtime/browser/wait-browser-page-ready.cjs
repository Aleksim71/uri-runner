// path: src/runtime/browser/wait-browser-page-ready.cjs
'use strict';

const {
  getBrowserSessionState,
  updateBrowserSessionState
} = require('./browser-session-store.cjs');

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function waitBrowserPageReady(options) {
  if (!options || typeof options !== 'object') {
    throw new Error('waitBrowserPageReady options must be an object.');
  }

  const runtimeContext = options.runtimeContext;
  const sessionId = options.sessionId;

  if (!runtimeContext || typeof runtimeContext !== 'object') {
    throw new Error('waitBrowserPageReady runtimeContext is required.');
  }

  if (!isNonEmptyString(sessionId)) {
    throw new Error('waitBrowserPageReady sessionId is required.');
  }

  const session = getBrowserSessionState(runtimeContext, sessionId);

  if (!isNonEmptyString(session.pageUrl)) {
    throw new Error(
      `waitBrowserPageReady requires opened pageUrl for session: ${sessionId}`
    );
  }

  const strategy = isNonEmptyString(options.strategy)
    ? options.strategy.trim()
    : 'load';

  const waitedMs = Number.isFinite(options.waitedMs)
    ? Math.max(0, options.waitedMs)
    : 0;

  const readyAt = new Date().toISOString();

  const nextState = updateBrowserSessionState(runtimeContext, sessionId, {
    ready: true,
    waitStrategy: strategy,
    waitedMs,
    runtime: {
      readyAt
    }
  });

  return {
    ok: true,
    sessionId: nextState.sessionId,
    target: nextState.target,
    pageUrl: nextState.pageUrl,
    ready: true,
    strategy,
    waitedMs,
    readyAt
  };
}

module.exports = {
  waitBrowserPageReady
};
