// path: src/runtime/browser/open-browser-page.cjs
'use strict';

function isAbsoluteHttpUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

function resolvePageUrl({ url, baseUrl }) {
  if (typeof url !== 'string' || url.trim() === '') {
    throw new Error('browser.page.open requires a non-empty url.');
  }

  if (isAbsoluteHttpUrl(url)) {
    return url;
  }

  if (typeof baseUrl !== 'string' || baseUrl.trim() === '') {
    throw new Error('baseUrl is required for relative browser.page.open url.');
  }

  return new URL(url, baseUrl).toString();
}

async function openBrowserPage({ page, input, baseUrl }) {
  const finalUrl = resolvePageUrl({
    url: input.url,
    baseUrl
  });

  await page.goto(finalUrl);
  return { finalUrl };
}

module.exports = {
  openBrowserPage,
  resolvePageUrl,
  isAbsoluteHttpUrl
};
