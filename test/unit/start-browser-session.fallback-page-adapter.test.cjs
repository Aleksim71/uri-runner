'use strict';

const { describe, it, expect } = require('vitest');
const { startBrowserSession } = require('../../src/runtime/browser/start-browser-session.cjs');

describe('startBrowserSession fallback page adapter', () => {
  it('creates runtime.page adapter when no endpoint is configured', async () => {
    const runtimeContext = {};

    const result = await startBrowserSession({
      runtimeContext,
      sessionId: 'fallback-session',
      input: {
        baseUrl: 'https://example.com'
      },
      environment: {
        target: 'browser',
        kind: 'scenario',
        source: 'test',
        baseUrl: 'https://example.com'
      }
    });

    expect(result.ok).toBe(true);
    expect(result.attached).toBe(false);
    expect(runtimeContext.browser.sessions['fallback-session'].runtime.page).toBeTruthy();

    const gotoResult = await runtimeContext.browser.sessions['fallback-session'].runtime.page.goto(
      'https://example.com/health'
    );

    expect(gotoResult).toEqual(
      expect.objectContaining({
        ok: true,
        finalUrl: 'https://example.com/health',
        url: 'https://example.com/health'
      })
    );
  });
});
