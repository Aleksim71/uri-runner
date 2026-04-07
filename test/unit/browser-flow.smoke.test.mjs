// path: test/unit/browser-flow.smoke.test.mjs

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { executeBrowserSessionStartStep } from '../../src/runtime/browser/execute-browser-session-start-step.cjs';
import { executeBrowserPageOpenStep } from '../../src/runtime/browser/execute-browser-page-open-step.cjs';
import { executeBrowserPageWaitStep } from '../../src/runtime/browser/execute-browser-page-wait-step.cjs';
import { executeBrowserDiagnosticsCollectStep } from '../../src/runtime/browser/execute-browser-diagnostics-collect-step.cjs';
import { executeBrowserSessionStopStep } from '../../src/runtime/browser/execute-browser-session-stop-step.cjs';

function createFakePage(title = 'Smoke Title') {
  let currentUrl = null;

  return {
    async goto(url) {
      currentUrl = url;
      return {
        ok: true,
        finalUrl: url,
        url,
      };
    },

    async title() {
      return title;
    },

    url() {
      return currentUrl;
    },
  };
}

describe('browser flow smoke', () => {
  it('runs full browser step range start -> open -> wait -> diagnostics -> stop', async () => {
    const runtimeContext = {
      browser: {
        sessions: {},
      },
      plan: {
        steps: [
          {
            command: 'browser.page.open',
            args: {
              url: 'https://example.com/smoke',
            },
          },
        ],
      },
    };

    const artifactsDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'uri-browser-smoke-')
    );

    const startResult = await executeBrowserSessionStartStep({
      runtimeContext,
      sessionId: 'smoke-session',
      input: {
        baseUrl: 'https://example.com',
      },
      environment: {
        target: 'browser',
        kind: 'debug',
        source: 'smoke-test',
        baseUrl: 'https://example.com',
        endpoint: null,
      },
    });

    expect(startResult.ok).toBe(true);
    expect(startResult.sessionId).toBe('smoke-session');

    runtimeContext.browser.sessions['smoke-session'].runtime.page =
      createFakePage('Smoke Title');

    const openResult = await executeBrowserPageOpenStep({
      runtimeContext,
      sessionId: 'smoke-session',
      input: {
        url: 'https://example.com/smoke',
      },
    });

    expect(openResult.ok).toBe(true);
    expect(openResult.url).toBe('https://example.com/smoke');
    expect(openResult.title).toBe('Smoke Title');

    const waitResult = await executeBrowserPageWaitStep({
      runtimeContext,
      sessionId: 'smoke-session',
      strategy: 'networkidle',
      waitedMs: 25,
    });

    expect(waitResult.ok).toBe(true);
    expect(waitResult.ready).toBe(true);
    expect(waitResult.strategy).toBe('networkidle');
    expect(waitResult.waitedMs).toBe(25);

    const diagnosticsResult = await executeBrowserDiagnosticsCollectStep({
      runtimeContext,
      sessionId: 'smoke-session',
      baseDir: artifactsDir,
      consoleEntries: [
        { level: 'info', message: 'hello' },
        { level: 'error', message: 'boom' },
      ],
      networkEntries: [
        { ok: true, url: 'https://example.com/a' },
        { ok: false, url: 'https://example.com/b' },
      ],
      pageTitle: 'Smoke Title',
      screenshot: 'fake-screenshot-data',
    });

    expect(diagnosticsResult.ok).toBe(true);
    expect(diagnosticsResult.stepType).toBe('browser.diagnostics.collect');
    expect(diagnosticsResult.consoleErrorCount).toBe(1);
    expect(diagnosticsResult.networkFailureCount).toBe(1);
    expect(diagnosticsResult.artifacts.summary).toBeTruthy();

    const summaryText = await fs.readFile(
      diagnosticsResult.artifacts.summary,
      'utf8'
    );
    expect(summaryText).toContain('"consoleErrorCount": 1');
    expect(summaryText).toContain('"networkFailureCount": 1');

    const stopResult = await executeBrowserSessionStopStep({
      runtimeContext,
      sessionId: 'smoke-session',
    });

    expect(stopResult.ok).toBe(true);
    expect(stopResult.stepType).toBe('browser.session.stop');
    expect(runtimeContext.browser.sessions).toEqual({});
  });
});
