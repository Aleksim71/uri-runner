// path: src/runtime/browser/execute-browser-page-open-step.cjs
'use strict';

const { openBrowserPage } = require('./open-browser-page.cjs');
const {
  getBrowserSessionState,
  updateBrowserSessionState
} = require('./browser-session-store.cjs');

function normalizeInput(ctx = {}) {
  if (ctx.input && typeof ctx.input === 'object') {
    return ctx.input;
  }

  const input = {};

  if (typeof ctx.path === 'string' && ctx.path.trim()) {
    input.url = ctx.path.trim();
  }

  if (typeof ctx.url === 'string' && ctx.url.trim()) {
    input.url = ctx.url.trim();
  }

  return input;
}

async function executeBrowserPageOpenStep(ctx = {}) {
  const runtimeContext =
    ctx.runtimeContext && typeof ctx.runtimeContext === 'object'
      ? ctx.runtimeContext
      : null;

  const input = normalizeInput(ctx);
  const sessionId =
    typeof ctx.sessionId === 'string' && ctx.sessionId.trim()
      ? ctx.sessionId.trim()
      : null;

  const directPage = ctx.page || null;
  const directBaseUrl = ctx.runtime && typeof ctx.runtime === 'object'
    ? ctx.runtime.baseUrl || null
    : null;

  let session = null;
  let page = directPage;
  let baseUrl = directBaseUrl || process.env.BASE_URL || null;

  if (runtimeContext && sessionId) {
    session = getBrowserSessionState(runtimeContext, sessionId);

    if (!page && session.runtime && typeof session.runtime === 'object') {
      page = session.runtime.page || null;
    }

    if (!baseUrl && typeof session.baseUrl === 'string' && session.baseUrl.trim()) {
      baseUrl = session.baseUrl.trim();
    }
  }

  if (!page) {
    const error = new Error(
      'browser.page.open requires a page instance. ' +
        'run-plan now passes runtimeContext/sessionId, so the page must be stored ' +
        'in browser session state at runtimeContext.browser.sessions[sessionId].runtime.page.'
    );
    error.code = 'BROWSER_PAGE_INSTANCE_MISSING';
    throw error;
  }

  const result = await openBrowserPage({
    page,
    input,
    baseUrl
  });

  const finalUrl =
    result && typeof result.finalUrl === 'string' && result.finalUrl.trim()
      ? result.finalUrl.trim()
      : result && typeof result.url === 'string' && result.url.trim()
        ? result.url.trim()
        : null;

  const pageTitle =
    result && typeof result.title === 'string' && result.title.trim()
      ? result.title.trim()
      : typeof page.title === 'function'
        ? await page.title()
        : null;

  if (runtimeContext && session) {
    updateBrowserSessionState(runtimeContext, session.sessionId, {
      pageUrl: finalUrl,
      pageTitle: pageTitle || null,
      ready: false,
      runtime: {
        openedAt: new Date().toISOString()
      }
    });
  }

  return {
    ok: true,
    ...result,
    url: finalUrl,
    title: pageTitle || null
  };
}

module.exports = {
  executeBrowserPageOpenStep
};
