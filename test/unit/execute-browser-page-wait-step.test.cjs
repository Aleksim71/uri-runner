// path: test/unit/execute-browser-page-wait-step.test.cjs
'use strict';

const { describe, it, expect } = require('vitest');

const {
  executeBrowserPageWaitStep
} = require('../../src/runtime/browser/execute-browser-page-wait-step.cjs');
const {
  startBrowserSession
} = require('../../src/runtime/browser/start-browser-session.cjs');
const {
  openBrowserPage
} = require('../../src/runtime/browser/open-browser-page.cjs');
const {
  getBrowserSessionState
} = require('../../src/runtime/browser/browser-session-store.cjs');

describe('executeBrowserPageWaitStep', () => {
  it('marks opened page as ready', () => {
    const runtimeContext = {};

    const session = startBrowserSession({
      runtimeContext,
      environment: {
        target: 'app',
        kind: 'web',
        source: 'local-server',
        baseUrl: 'http://127.0.0.1:3000'
      }
    });

    openBrowserPage({
      runtimeContext,
      sessionId: session.sessionId,
      path: '/health'
    });

    const result = executeBrowserPageWaitStep({
      runtimeContext,
      sessionId: session.sessionId,
      strategy: 'load',
      waitedMs: 150
    });

    expect(result.ok).toBe(true);
    expect(result.stepType).toBe('browser.page.wait');
    expect(result.ready).toBe(true);
    expect(result.strategy).toBe('load');
    expect(result.waitedMs).toBe(150);

    const state = getBrowserSessionState(runtimeContext, session.sessionId);
    expect(state.ready).toBe(true);
    expect(state.waitStrategy).toBe('load');
    expect(state.waitedMs).toBe(150);
  });

  it('uses defaults when strategy and waitedMs are omitted', () => {
    const runtimeContext = {};

    const session = startBrowserSession({
      runtimeContext,
      environment: {
        target: 'preview',
        kind: 'web',
        source: 'vite-preview',
        baseUrl: 'http://localhost:4173'
      }
    });

    openBrowserPage({
      runtimeContext,
      sessionId: session.sessionId
    });

    const result = executeBrowserPageWaitStep({
      runtimeContext,
      sessionId: session.sessionId
    });

    expect(result.ok).toBe(true);
    expect(result.strategy).toBe('load');
    expect(result.waitedMs).toBe(0);
  });
});
