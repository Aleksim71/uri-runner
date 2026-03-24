// path: test/unit/execute-browser-page-open-step.interface.test.cjs
'use strict';

const { describe, it, expect, vi } = require('vitest');

vi.mock('../../src/runtime/browser/open-browser-page.cjs', () => ({
  openBrowserPage: vi.fn(async ({ input }) => ({
    url: input.url,
    title: 'Example Domain'
  }))
}));

const {
  executeBrowserPageOpenStep
} = require('../../src/runtime/browser/execute-browser-page-open-step.cjs');

describe('executeBrowserPageOpenStep interface bridge', () => {
  it('reads page from session runtime and updates session metadata', async () => {
    const runtimeContext = {
      browser: {
        sessions: {
          s1: {
            sessionId: 's1',
            baseUrl: 'https://example.com',
            runtime: {
              page: { goto: async () => {} }
            },
            diagnostics: {}
          }
        }
      }
    };

    const result = await executeBrowserPageOpenStep({
      runtimeContext,
      sessionId: 's1',
      input: {
        url: 'https://example.com'
      }
    });

    expect(result.ok).toBe(true);
    expect(runtimeContext.browser.sessions.s1.pageUrl).toBe('https://example.com');
    expect(runtimeContext.browser.sessions.s1.pageTitle).toBe('Example Domain');
  });

  it('throws BROWSER_PAGE_INSTANCE_MISSING when session page is absent', async () => {
    const runtimeContext = {
      browser: {
        sessions: {
          s1: {
            sessionId: 's1',
            baseUrl: 'https://example.com',
            runtime: {},
            diagnostics: {}
          }
        }
      }
    };

    await expect(
      executeBrowserPageOpenStep({
        runtimeContext,
        sessionId: 's1',
        input: {
          url: 'https://example.com'
        }
      })
    ).rejects.toMatchObject({
      code: 'BROWSER_PAGE_INSTANCE_MISSING'
    });
  });
});
