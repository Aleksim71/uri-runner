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
      { id: null, name: 'browser.session.start', input: {} },
      {
        id: null,
        name: 'browser.page.open',
        input: { url: 'https://example.com' }
      },
      {
        id: null,
        name: 'browser.page.wait',
        input: { waitUntil: 'networkidle', timeoutMs: 3000 }
      },
      { id: null, name: 'browser.diagnostics.collect', input: {} },
      { id: null, name: 'browser.session.stop', input: {} }
    ]);
  });

  test('returns empty array when browser config is missing', () => {
    expect(compileBrowserFlow()).toEqual([]);
    expect(compileBrowserFlow(null)).toEqual([]);
  });

  test('returns empty array when browser flow key is missing', () => {
    expect(compileBrowserFlow({})).toEqual([]);
  });

  test('throws when browser flow is not an array', () => {
    expect(() => compileBrowserFlow({ flow: {} })).toThrow('browser.flow must be an array.');
    expect(() => compileBrowserFlow({ flow: undefined })).toThrow('browser.flow must be an array.');
    expect(() => compileBrowserFlow({ flow: null })).toThrow('browser.flow must be an array.');
  });

  test('throws on unsupported browser action', () => {
    expect(() =>
      compileBrowserFlow({
        flow: [{ action: 'page.click' }]
      })
    ).toThrow('Browser flow item at index 0 has unsupported action: page.click');
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

  test('keeps page.wait waitUntil as provided', () => {
    expect(
      compileBrowserFlow({
        flow: [{ action: 'page.wait', waitUntil: '' }]
      })
    ).toEqual([
      {
        id: null,
        name: 'browser.page.wait',
        input: { waitUntil: '' }
      }
    ]);
  });

  test('keeps page.wait timeoutMs as provided', () => {
    expect(
      compileBrowserFlow({
        flow: [{ action: 'page.wait', timeoutMs: -1 }]
      })
    ).toEqual([
      {
        id: null,
        name: 'browser.page.wait',
        input: { timeoutMs: -1 }
      }
    ]);
  });
});
