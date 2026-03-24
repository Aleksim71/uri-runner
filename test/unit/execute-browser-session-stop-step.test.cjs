// path: test/unit/execute-browser-session-stop-step.test.cjs
'use strict';

const { describe, it, expect } = require('vitest');

const {
  executeBrowserSessionStopStep
} = require('../../src/runtime/browser/execute-browser-session-stop-step.cjs');

const {
  startBrowserSession
} = require('../../src/runtime/browser/start-browser-session.cjs');

const {
  getBrowserSessionState
} = require('../../src/runtime/browser/browser-session-store.cjs');

describe('executeBrowserSessionStopStep', () => {
  it('stops session and removes it from store', () => {
    const runtimeContext = {};

    const session = startBrowserSession({
      runtimeContext,
      environment: {
        target: 'app',
        kind: 'web',
        source: 'local',
        baseUrl: 'http://127.0.0.1:3000'
      }
    });

    const result = executeBrowserSessionStopStep({
      runtimeContext,
      sessionId: session.sessionId
    });

    expect(result.ok).toBe(true);
    expect(result.stepType).toBe('browser.session.stop');
    expect(result.sessionId).toBe(session.sessionId);

    expect(() => {
      getBrowserSessionState(runtimeContext, session.sessionId);
    }).toThrow();
  });
});
