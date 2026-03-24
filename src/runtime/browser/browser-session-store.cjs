'use strict';

function ensureObject(value, message) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(message);
  }
}

function ensureRuntimeContext(runtimeContext) {
  ensureObject(runtimeContext, 'Runtime context must be an object.');

  if (!runtimeContext.browser) {
    runtimeContext.browser = {};
  }

  if (!runtimeContext.browser.sessions) {
    runtimeContext.browser.sessions = {};
  }

  ensureObject(
    runtimeContext.browser.sessions,
    'Runtime context browser.sessions must be an object.'
  );

  return runtimeContext.browser.sessions;
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function buildSessionId(target) {
  const safeTarget = isNonEmptyString(target) ? target.trim() : 'browser';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  return `${safeTarget}__${timestamp}`;
}

function createBrowserSessionState(runtimeContext, options) {
  const sessions = ensureRuntimeContext(runtimeContext);

  ensureObject(options, 'Browser session options must be an object.');

  const target = options.target;
  const baseUrl = options.baseUrl;

  if (!isNonEmptyString(target)) {
    throw new Error('Browser session target is required.');
  }

  if (!isNonEmptyString(baseUrl)) {
    throw new Error('Browser session baseUrl is required.');
  }

  const sessionId = isNonEmptyString(options.sessionId)
    ? options.sessionId.trim()
    : buildSessionId(target);

  if (sessions[sessionId]) {
    throw new Error(`Browser session already exists: ${sessionId}`);
  }

  const state = {
    sessionId,
    target: target.trim(),
    kind: isNonEmptyString(options.kind) ? options.kind.trim() : 'web',
    source: isNonEmptyString(options.source) ? options.source.trim() : 'unknown',
    baseUrl: baseUrl.trim(),
    startedAt: new Date().toISOString(),
    pageUrl: null,
    pageTitle: null,
    ready: false,
    waitStrategy: null,
    waitedMs: null,
    diagnostics: {
      consoleEntries: [],
      networkEntries: [],
      screenshotPath: null,
      pageMetaPath: null,
      summaryPath: null
    },
    runtime: {}
  };

  sessions[sessionId] = state;

  return state;
}

function getBrowserSessionState(runtimeContext, sessionId) {
  const sessions = ensureRuntimeContext(runtimeContext);

  if (!isNonEmptyString(sessionId)) {
    throw new Error('Browser sessionId is required.');
  }

  const state = sessions[sessionId.trim()];

  if (!state) {
    throw new Error(`Browser session not found: ${sessionId}`);
  }

  return state;
}

function updateBrowserSessionState(runtimeContext, sessionId, patch) {
  const state = getBrowserSessionState(runtimeContext, sessionId);

  ensureObject(patch, 'Browser session patch must be an object.');

  const nextState = {
    ...state,
    ...patch
  };

  if (patch.diagnostics && typeof patch.diagnostics === 'object' && !Array.isArray(patch.diagnostics)) {
    nextState.diagnostics = {
      ...state.diagnostics,
      ...patch.diagnostics
    };
  }

  if (patch.runtime && typeof patch.runtime === 'object' && !Array.isArray(patch.runtime)) {
    nextState.runtime = {
      ...state.runtime,
      ...patch.runtime
    };
  }

  const sessions = ensureRuntimeContext(runtimeContext);
  sessions[sessionId.trim()] = nextState;

  return nextState;
}

function clearBrowserSessionState(runtimeContext, sessionId) {
  const sessions = ensureRuntimeContext(runtimeContext);

  if (!isNonEmptyString(sessionId)) {
    throw new Error('Browser sessionId is required.');
  }

  const normalizedSessionId = sessionId.trim();
  const existing = sessions[normalizedSessionId] || null;

  delete sessions[normalizedSessionId];

  return existing;
}

module.exports = {
  buildSessionId,
  createBrowserSessionState,
  getBrowserSessionState,
  updateBrowserSessionState,
  clearBrowserSessionState
};
