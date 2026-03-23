// path: test/scenarios/browser-flow.network-summary.test.mjs

import { describe, expect, it } from 'vitest';
import { collectBrowserArtifacts } from '../../src/runtime/browser/collect-browser-artifacts.cjs';
import { normalizeBrowserResult } from '../../src/runtime/browser/normalize-browser-result.cjs';

describe('browser diagnostics network summary flow', () => {
  it('normalizes network-summary.json and failed request counts into browser-report', async () => {
    const collectResult = await collectBrowserArtifacts(
      {
        status: 'ok',
        session: {
          endpoint: '127.0.0.1:9222',
          browserType: 'chrome',
          targetId: 'target-1',
          targetUrl: 'https://example.com/',
          targetTitle: 'Example Domain',
          client: {
            async getPageMetadata() {
              return { title: 'Example Domain', url: 'https://example.com/' };
            },
            async takeScreenshot() {
              return Buffer.from('png').toString('base64');
            },
            async getConsoleSnapshot() {
              return {
                consoleMessages: [],
                pageErrors: [],
              };
            },
            async getNetworkSummary() {
              return {
                requests: [
                  {
                    requestId: 'doc-1',
                    url: 'https://example.com/',
                    method: 'GET',
                    resourceType: 'Document',
                    status: 200,
                  },
                  {
                    requestId: 'xhr-2',
                    url: 'https://example.com/api',
                    method: 'GET',
                    resourceType: 'XHR',
                    failed: true,
                    failureText: 'net::ERR_CONNECTION_REFUSED',
                  },
                ],
                totalRequests: 2,
                failedRequests: 1,
                statusCodeBuckets: { 200: 1 },
                resourceTypeBuckets: { Document: 1, XHR: 1 },
              };
            },
          },
        },
      },
      {
        collect: {
          metadata: true,
          screenshot: true,
          console: true,
          errors: true,
          networkSummary: true,
        },
        consoleSettleMs: 0,
        networkSettleMs: 0,
      }
    );

    const normalized = normalizeBrowserResult({
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
      collectResult,
    });

    const report = normalized.artifacts.find((artifact) => artifact.name === 'browser-report.json');
    const networkArtifact = normalized.artifacts.find((artifact) => artifact.name === 'network-summary.json');

    expect(normalized.status).toBe('warning');
    expect(networkArtifact.payload.totalRequests).toBe(2);
    expect(networkArtifact.payload.failedRequests).toBe(1);
    expect(report.payload.failedRequestCount).toBe(1);
    expect(report.payload.totalRequestCount).toBe(2);
  });
});
