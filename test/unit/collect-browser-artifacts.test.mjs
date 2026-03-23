// path: test/unit/collect-browser-artifacts.test.mjs

import { describe, expect, it } from 'vitest';
import { collectBrowserArtifacts } from '../../src/runtime/browser/collect-browser-artifacts.cjs';

describe('collectBrowserArtifacts', () => {
  it('collects real-artifact metadata and screenshot with session enrichment', async () => {
    const result = await collectBrowserArtifacts(
      {
        status: 'ok',
        session: {
          endpoint: '127.0.0.1:9222',
          browserType: 'chromium',
          targetId: 'page-1',
          targetUrl: 'http://localhost:5173/',
          targetTitle: 'App',
          client: {
            async getPageMetadata() {
              return {
                url: 'http://localhost:5173/',
                title: 'App',
                userAgent: 'FakeBrowser/1.0',
              };
            },
            async takeScreenshot() {
              return Buffer.from('fake-png-binary').toString('base64');
            },
            async getConsoleSnapshot() {
              return {
                consoleMessages: [],
                pageErrors: [],
              };
            },
          },
        },
      },
      {
        collect: {
          metadata: true,
          screenshot: true,
          console: false,
          errors: false,
        },
      }
    );

    expect(result.status).toBe('ok');
    expect(result.artifacts.pageMetadata.data.endpoint).toBe('127.0.0.1:9222');
    expect(result.artifacts.pageMetadata.data.targetId).toBe('page-1');
    expect(result.artifacts.pageMetadata.data.browserType).toBe('chromium');
    expect(Buffer.isBuffer(result.artifacts.screenshot.data)).toBe(true);
    expect(result.artifacts.console).toBeNull();
    expect(result.artifacts.errors).toBeNull();
  });

  it('collects live console entries and page errors through getConsoleSnapshot()', async () => {
    const result = await collectBrowserArtifacts(
      {
        status: 'ok',
        session: {
          endpoint: '127.0.0.1:9222',
          browserType: 'chromium',
          targetId: 'page-1',
          targetUrl: 'http://localhost:5173/',
          targetTitle: 'App',
          client: {
            async getPageMetadata() {
              return { title: 'App' };
            },
            async takeScreenshot() {
              return Buffer.from('fake-png-binary').toString('base64');
            },
            async getConsoleSnapshot() {
              return {
                consoleMessages: [
                  {
                    source: 'runtime.console',
                    type: 'log',
                    level: 'log',
                    text: 'hello world',
                    args: ['hello', 'world'],
                    timestamp: 1,
                  },
                  {
                    source: 'runtime.console',
                    type: 'error',
                    level: 'error',
                    text: 'boom',
                    args: ['boom'],
                    timestamp: 2,
                  },
                ],
                pageErrors: [
                  {
                    source: 'runtime.exception',
                    text: 'Uncaught Error: boom',
                    lineNumber: 10,
                    columnNumber: 5,
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

    expect(result.status).toBe('warning');
    expect(result.counts.consoleMessages).toBe(2);
    expect(result.counts.consoleErrors).toBe(1);
    expect(result.counts.pageErrors).toBe(1);
    expect(result.artifacts.console.data[1].text).toBe('boom');
    expect(result.artifacts.errors.data[0].lineNumber).toBe(10);
  });

  it('returns warning when screenshot payload is invalid', async () => {
    const result = await collectBrowserArtifacts(
      {
        status: 'ok',
        session: {
          endpoint: '127.0.0.1:9222',
          targetId: 'page-1',
          targetUrl: 'http://localhost:5173/',
          targetTitle: 'App',
          client: {
            async getPageMetadata() {
              return { title: 'App' };
            },
            async takeScreenshot() {
              return '';
            },
            async getConsoleSnapshot() {
              return {
                consoleMessages: [],
                pageErrors: [],
              };
            },
          },
        },
      },
      {
        collect: {
          metadata: true,
          screenshot: true,
          console: false,
          errors: false,
        },
      }
    );

    expect(result.status).toBe('warning');
    expect(result.artifacts.pageMetadata.data.targetId).toBe('page-1');
    expect(result.artifacts.screenshot).toBeNull();
    expect(result.warnings).toContain('Diagnostics client returned an invalid screenshot payload.');
  });
});
