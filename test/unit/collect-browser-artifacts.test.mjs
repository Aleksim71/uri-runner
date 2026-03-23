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
            async getConsoleMessages() {
              return [];
            },
            async getPageErrors() {
              return [];
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
