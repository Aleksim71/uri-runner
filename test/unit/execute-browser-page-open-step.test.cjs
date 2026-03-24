// path: test/unit/execute-browser-page-open-step.test.cjs
'use strict';

const { describe, it, expect } = require('vitest');

const {
  executeBrowserPageOpenStep
} = require('../../src/runtime/browser/execute-browser-page-open-step.cjs');
const {
  startBrowserSession
} = require('../../src/runtime/browser/start-browser-session.cjs');
const {
  getBrowserSessionState
} = require('../../src/runtime/browser/browser-session-store.cjs');

describe('executeBrowserPageOpenStep', () => {
  it('opens page for existing browser session', () => {
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

    const result = executeBrowserPageOpenStep({
      runtimeContext,
      sessionId: session.sessionId,
      path: '/health'
    });

    expect(result.ok).toBe(true);
    expect(result.stepType).toBe('browser.page.open');
    expect(result.pagePath).toBe('/health');
    expect(result.pageUrl).toBe('http://127.0.0.1:3000/health');

    const state = getBrowserSessionState(runtimeContext, session.sessionId);
    expect(state.pageUrl).toBe('http://127.0.0.1:3000/health');
    expect(state.runtime.pagePath).toBe('/health');
  });

  it('defaults to root path when path is omitted', () => {
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

    const result = executeBrowserPageOpenStep({
      runtimeContext,
      sessionId: session.sessionId
    });

    expect(result.ok).toBe(true);
    expect(result.pagePath).toBe('/');
    expect(result.pageUrl).toBe('http://localhost:4173/');
  });
});
