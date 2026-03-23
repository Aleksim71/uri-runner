// path: test/unit/normalize-browser-result.test.mjs

import { describe, expect, it } from 'vitest';
import { normalizeBrowserResult } from '../../src/runtime/browser/normalize-browser-result.cjs';

describe('normalizeBrowserResult', () => {
  it('builds a normalized browser-diagnostics result with browser-report.json', () => {
    const result = normalizeBrowserResult({
      goal: 'frontend-not-opening',
      mode: 'safe',
      attachResult: {
        status: 'ok',
        session: {
          targetUrl: 'http://localhost:5173/',
          targetTitle: 'App',
        },
        warnings: [],
        error: null,
      },
      collectResult: {
        status: 'warning',
        target: {
          url: 'http://localhost:5173/',
          title: 'App',
        },
        artifacts: {
          pageMetadata: { kind: 'json', data: { title: 'App' } },
          screenshot: { kind: 'binary', data: Buffer.from('png') },
          console: { kind: 'json', data: [{ level: 'error', text: 'boom' }] },
          errors: { kind: 'json', data: [{ message: 'boom' }] },
        },
        counts: {
          consoleMessages: 1,
          consoleErrors: 1,
          pageErrors: 1,
          failedRequests: 0,
        },
        warnings: ['Console contains runtime errors.'],
        error: null,
      },
    });

    expect(result.kind).toBe('browser-diagnostics');
    expect(result.status).toBe('warning');
    expect(result.summary.targetTitle).toBe('App');

    const browserReport = result.artifacts.find((artifact) => artifact.name === 'browser-report.json');
    expect(browserReport).toBeTruthy();
    expect(browserReport.payload.consoleErrorCount).toBe(1);
    expect(browserReport.payload.pageErrorCount).toBe(1);
  });
});
