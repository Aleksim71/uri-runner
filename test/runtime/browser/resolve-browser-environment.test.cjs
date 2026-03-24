// path: test/runtime/browser/resolve-browser-environment.test.cjs
'use strict';

const { describe, it, expect } = require('vitest');
const { resolveBrowserEnvironment } = require('../../../src/runtime/browser/resolve-browser-environment.cjs');

describe('resolveBrowserEnvironment', () => {
  it('resolves valid environment', () => {
    const result = resolveBrowserEnvironment({
      browser: { target: 'app' },
      environment: {
        app: {
          kind: 'web',
          baseUrl: 'http://localhost:3000'
        }
      }
    });

    expect(result.baseUrl).toBe('http://localhost:3000');
    expect(result.target).toBe('app');
  });

  it('throws on missing target', () => {
    expect(() => resolveBrowserEnvironment({ browser: {} })).toThrow();
  });

  it('throws on invalid url', () => {
    expect(() =>
      resolveBrowserEnvironment({
        browser: { target: 'app' },
        environment: {
          app: { kind: 'web', baseUrl: 'bad-url' }
        }
      })
    ).toThrow();
  });
});
