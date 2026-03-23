// path: test/scenarios/browser-flow.real-artifacts.test.mjs

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { runBrowserDiagnostics } from '../../src/runtime/browser/run-browser-diagnostics.cjs';

describe('browser-flow real artifacts', () => {
  it('writes screenshot, metadata and browser report for the minimal real-artifact path', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'uri-browser-real-artifacts-'));

    const result = await runBrowserDiagnostics(
      {
        endpoint: '127.0.0.1:9222',
        browserType: 'chromium',
        goal: 'frontend-not-opening',
        mode: 'safe',
        targetHint: { urlIncludes: 'example.com' },
        collect: {
          metadata: true,
          screenshot: true,
          console: false,
          errors: false,
        },
        adapter: {
          async listTargets() {
            return [
              { id: 'page-1', type: 'page', url: 'https://example.com/', title: 'Example Domain' },
            ];
          },
          async attachToTarget() {
            return {
              async getPageMetadata() {
                return {
                  title: 'Example Domain',
                  url: 'https://example.com/',
                  readyState: 'complete',
                };
              },
              async takeScreenshot() {
                return Buffer.from('png-data');
              },
              async close() {},
            };
          },
        },
      },
      {
        artifactsDir: tempDir,
      }
    );

    expect(result.status).toBe('ok');
    expect(result.normalizedResult.summary.targetTitle).toBe('Example Domain');

    const files = await fs.readdir(tempDir);
    expect(files).toContain('page-metadata.json');
    expect(files).toContain('screenshot.png');
    expect(files).toContain('browser-report.json');
  });
});
