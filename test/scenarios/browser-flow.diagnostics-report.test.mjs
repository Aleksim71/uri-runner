// path: test/scenarios/browser-flow.diagnostics-report.test.mjs

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { attachBrowserSession } from '../../src/runtime/browser/attach-browser-session.cjs';
import { collectBrowserArtifacts } from '../../src/runtime/browser/collect-browser-artifacts.cjs';
import { normalizeBrowserResult } from '../../src/runtime/browser/normalize-browser-result.cjs';
import { writeBrowserArtifacts } from '../../src/runtime/browser/write-browser-artifacts.cjs';

describe('browser-flow diagnostics report', () => {
  it('runs manual prep -> attach -> collect -> normalize -> write', async () => {
    const fakeClient = {
      async getPageMetadata() {
        return {
          url: 'http://localhost:5173/',
          title: 'App',
          userAgent: 'FakeBrowser/1.0',
        };
      },
      async takeScreenshot() {
        return Buffer.from('png-data');
      },
      async getConsoleMessages() {
        return [{ level: 'info', text: 'ready' }];
      },
      async getPageErrors() {
        return [];
      },
    };

    const attachResult = await attachBrowserSession({
      endpoint: 'ws://127.0.0.1:9222/devtools/browser/test',
      browserType: 'chromium',
      targetHint: { urlIncludes: 'localhost:5173' },
      adapter: {
        async listTargets() {
          return [{ id: 'tab-1', type: 'page', url: 'http://localhost:5173/', title: 'App' }];
        },
        async attachToTarget() {
          return fakeClient;
        },
      },
    });

    const collectResult = await collectBrowserArtifacts(attachResult, {});
    const normalizedResult = normalizeBrowserResult({
      goal: 'frontend-not-opening',
      mode: 'safe',
      attachResult,
      collectResult,
    });

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'uri-browser-scenario-'));
    const writeResult = await writeBrowserArtifacts(normalizedResult, {
      artifactsDir: tempDir,
    });

    expect(attachResult.status).toBe('ok');
    expect(collectResult.status).toBe('ok');
    expect(normalizedResult.status).toBe('ok');
    expect(writeResult.status).toBe('ok');

    const reportPath = path.join(tempDir, 'browser-report.json');
    const reportContent = await fs.readFile(reportPath, 'utf8');

    expect(reportContent).toContain('"kind": "browser-report"');
    expect(reportContent).toContain('"status": "ok"');
  });
});
