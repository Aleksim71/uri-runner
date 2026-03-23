// path: test/unit/cdp-client.test.mjs

import { describe, expect, it } from 'vitest';
import {
  createCdpClientAdapter,
  normalizeCdpEndpoint,
} from '../../src/runtime/browser/cdp-client.cjs';

describe('normalizeCdpEndpoint', () => {
  it('normalizes websocket endpoints', () => {
    const result = normalizeCdpEndpoint('ws://127.0.0.1:9222/devtools/browser/test');

    expect(result.host).toBe('127.0.0.1');
    expect(result.port).toBe(9222);
    expect(result.websocketUrl).toContain('/devtools/browser/test');
  });
});

describe('createCdpClientAdapter', () => {
  it('lists targets through the injected CDP transport', async () => {
    const transport = Object.assign(async () => ({}), {
      async List() {
        return [
          {
            id: 'page-1',
            type: 'page',
            url: 'http://localhost:4173/',
            title: 'Preview',
            webSocketDebuggerUrl: 'ws://127.0.0.1:9222/devtools/page/page-1',
          },
        ];
      },
      async New() {
        return {
          id: 'page-2',
          type: 'page',
          url: 'about:blank',
          title: '',
          webSocketDebuggerUrl: 'ws://127.0.0.1:9222/devtools/page/page-2',
        };
      },
    });

    const adapter = createCdpClientAdapter({ transport });
    const targets = await adapter.listTargets('ws://127.0.0.1:9222/devtools/browser/test');

    expect(targets).toHaveLength(1);
    expect(targets[0].id).toBe('page-1');
    expect(targets[0].url).toContain('localhost:4173');
  });

  it('attaches and buffers console snapshots and page error events', async () => {
    const events = {};
    const transport = Object.assign(
      async () => ({
        Page: {
          async enable() {},
          async captureScreenshot() {
            return { data: Buffer.from('png-bytes').toString('base64') };
          },
        },
        Runtime: {
          async enable() {},
          async evaluate() {
            return { result: { value: 'complete' } };
          },
          consoleAPICalled(handler) {
            events.console = handler;
          },
          exceptionThrown(handler) {
            events.exception = handler;
          },
        },
        Log: {
          async enable() {},
          entryAdded(handler) {
            events.log = handler;
          },
        },
        async close() {},
      }),
      {
        async List() {
          return [];
        },
        async New() {
          return {};
        },
      }
    );

    const adapter = createCdpClientAdapter({ transport });
    const client = await adapter.attachToTarget('ws://127.0.0.1:9222/devtools/browser/test', {
      id: 'page-1',
      type: 'page',
      url: 'http://localhost:4173/',
      title: 'Preview',
      webSocketDebuggerUrl: 'ws://127.0.0.1:9222/devtools/page/page-1',
    });

    events.console({
      type: 'log',
      args: [{ value: 'hello' }, { value: 'world' }],
      timestamp: 1,
    });
    events.console({
      type: 'error',
      args: [{ value: 'boom' }],
      timestamp: 2,
    });
    events.exception({
      exceptionDetails: { text: 'Boom', lineNumber: 10, columnNumber: 2 },
      timestamp: 3,
    });
    events.log({
      entry: {
        source: 'network',
        level: 'error',
        text: 'GET /api failed',
        timestamp: 4,
      },
    });

    const snapshot = await client.getConsoleSnapshot({ settleMs: 0 });
    const screenshot = await client.takeScreenshot();

    expect(snapshot.consoleMessages).toHaveLength(3);
    expect(snapshot.pageErrors).toHaveLength(2);
    expect(snapshot.consoleMessages[1].level).toBe('error');
    expect(snapshot.pageErrors[0].text).toBe('Boom');
    expect(screenshot).toBeTypeOf('string');
  });
});
