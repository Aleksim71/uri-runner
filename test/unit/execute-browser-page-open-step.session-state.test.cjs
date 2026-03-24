// path: test/unit/execute-browser-page-open-step.session-state.test.cjs
'use strict';

const { describe, it, expect, vi } = require('vitest');

vi.mock('../../src/runtime/browser/open-browser-page.cjs', () => ({
  openBrowserPage: vi.fn(async () => ({
    finalUrl: 'https://example.com/',
  }))
}));

const {
  executeBrowserPageOpenStep
} = require('../../src/runtime/browser/execute-browser-page-open-step.cjs');

describe('executeBrowserPageOpenStep session state sync', () => {
  it('writes session.pageUrl from result.finalUrl', async () => {
    const runtimeContext = {
      browser: {
        sessions: {
          s1: {
            sessionId: 's1',
            baseUrl: 'https://example.com',
            runtime: {
              page: {
                goto: vi.fn(async () => {}),
                title: vi.fn(async () => 'Example Domain')
              }
            },
            diagnostics: {}
          }
        }
      }
    };

    const result = await executeBrowserPageOpenStep({
      runtimeContext,
      sessionId: 's1',
      input: { url: 'https://example.com' }
    });

    expect(result.ok).toBe(true);
    expect(result.url).toBe('https://example.com/');
    expect(runtimeContext.browser.sessions.s1.pageUrl).toBe('https://example.com/');
    expect(runtimeContext.browser.sessions.s1.pageTitle).toBe('Example Domain');
  });
});
