// path: test/unit/run-browser-diagnostics.test.mjs

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { runBrowserDiagnostics } from '../../src/runtime/browser/run-browser-diagnostics.cjs';

describe('runBrowserDiagnostics', () => {
  it('runs attach -> collect -> normalize -> write for screenshot and metadata', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'uri-browser-run-'));
    let closed = false;

    const result = await runBrowserDiagnostics(
      {
        endpoint: 'ws://127.0.0.1:9222/devtools/browser/test',
        browserType: 'chromium',
        goal: 'browser-smoke',
        mode: 'safe',
        targetHint: { urlIncludes: 'localhost:4173' },
        collect: {
          metadata: true,
          screenshot: true,
          console: false,
          errors: false,
        },
        adapter: {
          async listTargets() {
            return [
              { id: 'page-1', type: 'page', url: 'http://localhost:4173/', title: 'Preview' },
            ];
          },
          async attachToTarget() {
            return {
              async getPageMetadata() {
                return {
                  title: 'Preview',
                  url: 'http://localhost:4173/',
                  readyState: 'complete',
                };
              },
              async takeScreenshot() {
                return Buffer.from('png-data').toString('base64');
              },
              async close() {
                closed = true;
              },
            };
          },
        },
      },
      {
        artifactsDir: tempDir,
      }
    );

    expect(result.status).toBe('ok');
    expect(result.attachResult.status).toBe('ok');
    expect(result.collectResult.status).toBe('ok');
    expect(result.writeResult.status).toBe('ok');
    expect(closed).toBe(true);

    const metadataText = await fs.readFile(path.join(tempDir, 'page-metadata.json'), 'utf8');
    const reportText = await fs.readFile(path.join(tempDir, 'browser-report.json'), 'utf8');

    expect(metadataText).toContain('"browserType": "chromium"');
    expect(reportText).toContain('"status": "ok"');
    expect(result.writeResult.written.map((item) => item.name)).toContain('screenshot.png');
  });

  it('accepts artifactsDir from input when io.artifactsDir is omitted', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'uri-browser-run-input-'));

    const result = await runBrowserDiagnostics({
      endpoint: 'ws://127.0.0.1:9222/devtools/browser/test',
      browserType: 'chromium',
      goal: 'browser-smoke',
      mode: 'safe',
      artifactsDir: tempDir,
      targetHint: { urlIncludes: 'localhost:4173' },
      collect: {
        metadata: true,
        screenshot: true,
        console: false,
        errors: false,
      },
      adapter: {
        async listTargets() {
          return [
            { id: 'page-1', type: 'page', url: 'http://localhost:4173/', title: 'Preview' },
          ];
        },
        async attachToTarget() {
          return {
            async getPageMetadata() {
              return {
                title: 'Preview',
                url: 'http://localhost:4173/',
                readyState: 'complete',
              };
            },
            async takeScreenshot() {
              return Buffer.from('png-data').toString('base64');
            },
            async close() {},
          };
        },
      },
    });

    expect(result.status).toBe('ok');
    expect(result.writeResult.status).toBe('ok');
    expect(result.writeResult.manifest.baseDir).toBe(tempDir);
  });

  it('accepts outputDir as a backward-compatible alias', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'uri-browser-run-output-'));

    const result = await runBrowserDiagnostics({
      endpoint: 'ws://127.0.0.1:9222/devtools/browser/test',
      browserType: 'chromium',
      goal: 'browser-smoke',
      mode: 'safe',
      outputDir: tempDir,
      targetHint: { urlIncludes: 'localhost:4173' },
      collect: {
        metadata: true,
        screenshot: true,
        console: false,
        errors: false,
      },
      adapter: {
        async listTargets() {
          return [
            { id: 'page-1', type: 'page', url: 'http://localhost:4173/', title: 'Preview' },
          ];
        },
        async attachToTarget() {
          return {
            async getPageMetadata() {
              return {
                title: 'Preview',
                url: 'http://localhost:4173/',
                readyState: 'complete',
              };
            },
            async takeScreenshot() {
              return Buffer.from('png-data').toString('base64');
            },
            async close() {},
          };
        },
      },
    });

    expect(result.status).toBe('ok');
    expect(result.writeResult.status).toBe('ok');
    expect(result.writeResult.manifest.baseDir).toBe(tempDir);
  });
});
