// path: src/runtime/browser/start-browser-session.cjs
'use strict';

const {
  createBrowserSessionState
} = require('./browser-session-store.cjs');

function startBrowserSession(options) {
  if (!options || typeof options !== 'object') {
    throw new Error('startBrowserSession options must be an object.');
  }

  const runtimeContext = options.runtimeContext;
  const environment = options.environment;

  if (!runtimeContext || typeof runtimeContext !== 'object') {
    throw new Error('startBrowserSession runtimeContext is required.');
  }

  if (!environment || typeof environment !== 'object') {
    throw new Error('startBrowserSession environment is required.');
  }

  const session = createBrowserSessionState(runtimeContext, {
    sessionId: options.sessionId,
    target: environment.target,
    kind: environment.kind,
    source: environment.source,
    baseUrl: environment.baseUrl
  });

  return {
    ok: true,
    sessionId: session.sessionId,
    target: session.target,
    kind: session.kind,
    source: session.source,
    baseUrl: session.baseUrl,
    startedAt: session.startedAt
  };
}

module.exports = {
  startBrowserSession
};
