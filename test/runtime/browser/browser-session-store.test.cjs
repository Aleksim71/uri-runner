// path: test/runtime/browser/browser-session-store.test.cjs
'use strict';

const { describe, it, expect } = require('vitest');
const {
  createBrowserSessionState,
  getBrowserSessionState,
  updateBrowserSessionState,
  clearBrowserSessionState
} = require('../../../src/runtime/browser/browser-session-store.cjs');

describe('browser-session-store', () => {
  it('creates and retrieves session', () => {
    const ctx = {};
    const session = createBrowserSessionState(ctx, {
      target: 'app',
      baseUrl: 'http://localhost'
    });

    const loaded = getBrowserSessionState(ctx, session.sessionId);
    expect(loaded.target).toBe('app');
  });

  it('updates session', () => {
    const ctx = {};
    const session = createBrowserSessionState(ctx, {
      target: 'app',
      baseUrl: 'http://localhost'
    });

    updateBrowserSessionState(ctx, session.sessionId, { ready: true });

    const updated = getBrowserSessionState(ctx, session.sessionId);
    expect(updated.ready).toBe(true);
  });

  it('clears session', () => {
    const ctx = {};
    const session = createBrowserSessionState(ctx, {
      target: 'app',
      baseUrl: 'http://localhost'
    });

    clearBrowserSessionState(ctx, session.sessionId);

    expect(() => getBrowserSessionState(ctx, session.sessionId)).toThrow();
  });
});
