// path: test/unit/execute-browser-diagnostics-collect-step.test.cjs
'use strict';

const { describe, it, expect } = require('vitest');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const {
  executeBrowserDiagnosticsCollectStep
} = require('../../src/runtime/browser/execute-browser-diagnostics-collect-step.cjs');
const {
  startBrowserSession
} = require('../../src/runtime/browser/start-browser-session.cjs');
const {
  openBrowserPage
} = require('../../src/runtime/browser/open-browser-page.cjs');
const {
  waitBrowserPageReady
} = require('../../src/runtime/browser/wait-browser-page-ready.cjs');

describe('executeBrowserDiagnosticsCollectStep', () => {
  it('collects diagnostics and writes report files', async () => {
    const runtimeContext = {};

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'browser-report-'));

    const session = startBrowserSession({
      runtimeContext,
      environment: {
        target: 'app',
        kind: 'web',
        source: 'local',
        baseUrl: 'http://127.0.0.1:3000'
      }
    });

    openBrowserPage({
      runtimeContext,
      sessionId: session.sessionId,
      path: '/health'
    });

    waitBrowserPageReady({
      runtimeContext,
      sessionId: session.sessionId
    });

    const result = await executeBrowserDiagnosticsCollectStep({
      runtimeContext,
      sessionId: session.sessionId,
      baseDir: tmpDir,
      consoleEntries: [{ level: 'error', message: 'boom' }],
      networkEntries: [{ ok: false }]
    });

    expect(result.ok).toBe(true);
    expect(result.consoleErrorCount).toBe(1);
    expect(result.networkFailureCount).toBe(1);

    const reportDir = path.join(tmpDir, 'REPORT', 'browser');
    expect(fs.existsSync(reportDir)).toBe(true);

    const summaryPath = path.join(reportDir, 'diagnostics-summary.json');
    expect(fs.existsSync(summaryPath)).toBe(true);
  });
});
