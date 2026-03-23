// path: test/scenarios/browser-flow.console-collection.test.mjs

import { describe, expect, it } from 'vitest';
import { normalizeBrowserResult } from '../../src/runtime/browser/normalize-browser-result.cjs';
import { collectBrowserArtifacts } from '../../src/runtime/browser/collect-browser-artifacts.cjs';

describe('browser diagnostics console collection flow', () => {
  it('normalizes live console and error artifacts into browser-report', async () => {
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
                consoleMessages: [
                  {
                    source: 'runtime.console',
                    type: 'warn',
                    level: 'warning',
                    text: 'hydration mismatch',
                    args: ['hydration mismatch'],
                    timestamp: 1,
                  },
                  {
                    source: 'runtime.console',
                    type: 'error',
                    level: 'error',
                    text: 'render failed',
                    args: ['render failed'],
                    timestamp: 2,
                  },
                ],
                pageErrors: [
                  {
                    source: 'runtime.exception',
                    text: 'Uncaught TypeError: render failed',
                    lineNumber: 7,
                    columnNumber: 15,
                    timestamp: 3,
                  },
                ],
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
        },
        consoleSettleMs: 0,
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
    const consoleArtifact = normalized.artifacts.find((artifact) => artifact.name === 'console.json');
    const errorsArtifact = normalized.artifacts.find((artifact) => artifact.name === 'errors.json');

    expect(normalized.status).toBe('warning');
    expect(consoleArtifact.payload).toHaveLength(2);
    expect(errorsArtifact.payload).toHaveLength(1);
    expect(report.payload.consoleErrorCount).toBe(1);
    expect(report.payload.pageErrorCount).toBe(1);
  });
});
