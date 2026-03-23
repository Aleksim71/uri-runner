// path: test/unit/attach-browser-session.test.mjs

import { describe, expect, it } from 'vitest';
import { attachBrowserSession } from '../../src/runtime/browser/attach-browser-session.cjs';

describe('attachBrowserSession', () => {
  it('attaches to the matching browser target', async () => {
    const fakeClient = { kind: 'fake-client' };

    const result = await attachBrowserSession({
      endpoint: 'ws://127.0.0.1:9222/devtools/browser/test',
      browserType: 'chromium',
      targetHint: { urlIncludes: 'localhost:5173' },
      adapter: {
        async listTargets() {
          return [
            { id: 'a', type: 'page', url: 'http://example.com', title: 'Example' },
            { id: 'b', type: 'page', url: 'http://localhost:5173/', title: 'App' },
          ];
        },
        async attachToTarget(endpoint, target) {
          return { ...fakeClient, endpoint, targetId: target.id };
        },
      },
    });

    expect(result.status).toBe('ok');
    expect(result.session.targetId).toBe('b');
    expect(result.session.targetUrl).toContain('localhost:5173');
    expect(result.session.client.targetId).toBe('b');
  });

  it('returns failed when no target matches', async () => {
    const result = await attachBrowserSession({
      endpoint: 'ws://127.0.0.1:9222/devtools/browser/test',
      targetHint: { urlIncludes: 'missing-target' },
      adapter: {
        async listTargets() {
          return [{ id: 'a', type: 'page', url: 'http://example.com', title: 'Example' }];
        },
      },
    });

    expect(result.status).toBe('failed');
    expect(result.error.code).toBe('target_not_found');
  });
});
