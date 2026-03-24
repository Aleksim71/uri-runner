// path: test/unit/start-browser-session.cdp-adapter.test.cjs
'use strict';

const { describe, it, expect, vi } = require('vitest');

vi.mock('../../src/runtime/browser/attach-browser-session.cjs', () => ({
  attachBrowserSession: vi.fn(async () => ({
    status: 'ok',
    session: {
      client: {
        rawClient: {
          Page: {
            navigate: vi.fn(async ({ url }) => ({ frameId: 'f1', loaderId: 'l1', url }))
          }
        },
        getPageMetadata: vi.fn(async () => ({ title: 'Example Domain' }))
      },
      targetUrl: 'https://example.com'
    }
  }))
}));

const { startBrowserSession } = require('../../src/runtime/browser/start-browser-session.cjs');

describe('startBrowserSession CDP adapter bridge', () => {
  it('creates runtime.page adapter backed by rawClient.Page.navigate', async () => {
    const runtimeContext = {};
    const result = await startBrowserSession({
      runtimeContext,
      sessionId: 's1',
      input: { endpoint: 'http://127.0.0.1:9222' },
      environment: {
        target: 'browser',
        kind: 'web',
        source: 'test',
        baseUrl: 'https://example.com'
      }
    });

    expect(result.ok).toBe(true);
    expect(runtimeContext.browser.sessions.s1.runtime.page).toBeTruthy();
    await expect(
      runtimeContext.browser.sessions.s1.runtime.page.goto('https://example.com')
    ).resolves.toBeTruthy();
  });
});
