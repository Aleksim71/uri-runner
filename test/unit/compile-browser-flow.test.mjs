// path: test/unit/compile-browser-flow.test.mjs

import { describe, expect, test } from 'vitest';
import { compileBrowserFlow } from '../../src/uram/compile-browser-flow.cjs';

describe('compileBrowserFlow', () => {
  test('compiles full browser flow into runtime steps', () => {
    const browser = {
      flow: [
        { action: 'session.start' },
        { action: 'page.open', url: 'https://example.com' },
        { action: 'page.wait', waitUntil: 'networkidle', timeoutMs: 3000 },
        { action: 'diagnostics.collect' },
        { action: 'session.stop' }
      ]
    };

    expect(compileBrowserFlow(browser)).toEqual([
      { name: 'browser.session.start', input: {} },
      { name: 'browser.page.open', input: { url: 'https://example.com' } },
      {
        name: 'browser.page.wait',
        input: { waitUntil: 'networkidle', timeoutMs: 3000 }
      },
      { name: 'browser.diagnostics.collect', input: {} },
      { name: 'browser.session.stop', input: {} }
    ]);
  });

  test('returns empty array when browser config is missing', () => {
    expect(compileBrowserFlow()).toEqual([]);
    expect(compileBrowserFlow(null)).toEqual([]);
  });

  test('returns empty array when browser flow is missing', () => {
    expect(compileBrowserFlow({})).toEqual([]);
    expect(compileBrowserFlow({ flow: undefined })).toEqual([]);
    expect(compileBrowserFlow({ flow: null })).toEqual([]);
  });

  test('throws when browser flow is not an array', () => {
    expect(() => compileBrowserFlow({ flow: {} })).toThrow('Browser flow must be an array.');
  });

  test('throws on unknown browser action', () => {
    expect(() =>
      compileBrowserFlow({
        flow: [{ action: 'page.click' }]
      })
    ).toThrow('Browser flow item at index 0 has unknown action: page.click');
  });

  test('throws when page.open has no url', () => {
    expect(() =>
      compileBrowserFlow({
        flow: [{ action: 'page.open' }]
      })
    ).toThrow('Browser flow item at index 0 with action page.open must include url.');
  });

  test('throws when flow item is not an object', () => {
    expect(() =>
      compileBrowserFlow({
        flow: ['session.start']
      })
    ).toThrow('Browser flow item at index 0 must be an object.');
  });

  test('throws when action is missing', () => {
    expect(() =>
      compileBrowserFlow({
        flow: [{}]
      })
    ).toThrow('Browser flow item at index 0 must include action.');
  });

  test('throws when page.wait waitUntil is empty string', () => {
    expect(() =>
      compileBrowserFlow({
        flow: [{ action: 'page.wait', waitUntil: '' }]
      })
    ).toThrow(
      'Browser flow item at index 0 with action page.wait must use a non-empty string waitUntil when provided.'
    );
  });

  test('throws when page.wait timeoutMs is invalid', () => {
    expect(() =>
      compileBrowserFlow({
        flow: [{ action: 'page.wait', timeoutMs: -1 }]
      })
    ).toThrow(
      'Browser flow item at index 0 with action page.wait must use a non-negative integer timeoutMs when provided.'
    );
  });
});
