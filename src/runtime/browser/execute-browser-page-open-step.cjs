// path: src/runtime/browser/execute-browser-page-open-step.cjs
'use strict';

const {
  openBrowserPage
} = require('./open-browser-page.cjs');

function executeBrowserPageOpenStep(options) {
  if (!options || typeof options !== 'object') {
    throw new Error('executeBrowserPageOpenStep options must be an object.');
  }

  const runtimeContext = options.runtimeContext;
  if (!runtimeContext || typeof runtimeContext !== 'object') {
    throw new Error('executeBrowserPageOpenStep runtimeContext is required.');
  }

  const sessionId = options.sessionId;
  const path = options.path;

  const result = openBrowserPage({
    runtimeContext,
    sessionId,
    path
  });

  return {
    ok: true,
    stepType: 'browser.page.open',
    sessionId: result.sessionId,
    target: result.target,
    pagePath: result.pagePath,
    pageUrl: result.pageUrl,
    openedAt: result.openedAt
  };
}

module.exports = {
  executeBrowserPageOpenStep
};
