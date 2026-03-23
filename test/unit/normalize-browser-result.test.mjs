// path: test/unit/normalize-browser-result.test.mjs

import { describe, expect, it } from 'vitest';
import { normalizeBrowserResult } from '../../src/runtime/browser/normalize-browser-result.cjs';

describe('normalizeBrowserResult', () => {
  it('includes network-summary.json and request counts in browser-report', () => {
    const result = normalizeBrowserResult({
      goal: 'browser-diagnostics',
      mode: 'safe',
      attachResult: {
        status: 'ok',
        session: {
          targetUrl: 'https://example.com/',
          targetTitle: 'Example Domain',
        },
        warnings: [],
        error: null,
      },
      collectResult: {
        status: 'warning',
        target: {
          url: 'https://example.com/',
          title: 'Example Domain',
        },
        artifacts: {
          pageMetadata: { data: { url: 'https://example.com/' } },
          screenshot: { data: Buffer.from('png') },
          console: { data: [] },
          errors: { data: [] },
          networkSummary: {
            data: {
              requests: [{ requestId: 'r1', url: 'https://example.com/', status: 200 }],
              totalRequests: 1,
              failedRequests: 0,
              statusCodeBuckets: { 200: 1 },
              resourceTypeBuckets: { Document: 1 },
            },
          },
        },
        counts: {
          consoleMessages: 0,
          consoleErrors: 0,
          pageErrors: 0,
          totalRequests: 1,
          failedRequests: 0,
        },
        warnings: [],
        error: null,
      },
    });

    const report = result.artifacts.find((artifact) => artifact.name === 'browser-report.json');
    const network = result.artifacts.find((artifact) => artifact.name === 'network-summary.json');

    expect(network).toBeTruthy();
    expect(report.payload.totalRequestCount).toBe(1);
    expect(report.payload.failedRequestCount).toBe(0);
    expect(result.summary.totalRequestCount).toBe(1);
  });
});
