// path: src/runtime/browser/open-browser-page.cjs
'use strict';

const {
  getBrowserSessionState,
  updateBrowserSessionState
} = require('./browser-session-store.cjs');

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function buildPageUrl(baseUrl, pagePath) {
  const url = new URL(baseUrl);

  if (!isNonEmptyString(pagePath) || pagePath.trim() === '/') {
    return url.toString();
  }

  url.pathname = pagePath.trim();
  return url.toString();
}

function openBrowserPage(options) {
  if (!options || typeof options !== 'object') {
    throw new Error('openBrowserPage options must be an object.');
  }

  const runtimeContext = options.runtimeContext;
  const sessionId = options.sessionId;

  if (!runtimeContext || typeof runtimeContext !== 'object') {
    throw new Error('openBrowserPage runtimeContext is required.');
  }

  if (!isNonEmptyString(sessionId)) {
    throw new Error('openBrowserPage sessionId is required.');
  }

  const session = getBrowserSessionState(runtimeContext, sessionId);
  const pagePath = isNonEmptyString(options.path) ? options.path.trim() : '/';
  const pageUrl = buildPageUrl(session.baseUrl, pagePath);
  const openedAt = new Date().toISOString();

  const nextState = updateBrowserSessionState(runtimeContext, sessionId, {
    pageUrl,
    runtime: {
      openedAt,
      pagePath
    }
  });

  return {
    ok: true,
    sessionId: nextState.sessionId,
    target: nextState.target,
    pagePath,
    pageUrl,
    openedAt
  };
}

module.exports = {
  openBrowserPage,
  buildPageUrl
};
