// path: src/runtime/browser/execute-browser-page-open-step.cjs
'use strict';

const { openBrowserPage } = require('./open-browser-page.cjs');

async function executeBrowserPageOpenStep(ctx) {
  const { page, input, runtime } = ctx;

  const baseUrl = runtime?.baseUrl || process.env.BASE_URL;

  if (!page) {
    throw new Error('browser.page.open requires a page instance.');
  }

  const result = await openBrowserPage({
    page,
    input,
    baseUrl
  });

  return {
    ok: true,
    ...result
  };
}

module.exports = {
  executeBrowserPageOpenStep
};
