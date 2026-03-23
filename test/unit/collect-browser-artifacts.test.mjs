// path: test/unit/collect-browser-artifacts.test.mjs

import { describe, expect, it } from 'vitest';
import { collectBrowserArtifacts } from '../../src/runtime/browser/collect-browser-artifacts.cjs';

describe('collectBrowserArtifacts', () => {
  it('collects the minimal A19.1 safe artifact set', async () => {
    const result = await collectBrowserArtifacts(
      {
        status: 'ok',
        session: {
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
              return Buffer.from('fake-png-binary');
            },
            async getConsoleMessages() {
              return [
                { level: 'info', text: 'hello' },
                { level: 'error', text: 'boom' },
              ];
            },
            async getPageErrors() {
              return [{ message: 'boom' }];
            },
          },
        },
      },
      {}
    );

    expect(result.status).toBe('warning');
    expect(result.artifacts.pageMetadata.data.title).toBe('App');
    expect(Buffer.isBuffer(result.artifacts.screenshot.data)).toBe(true);
    expect(result.artifacts.console.data).toHaveLength(2);
    expect(result.artifacts.errors.data).toHaveLength(1);
    expect(result.counts.consoleErrors).toBe(1);
  });
});
