// path: src/runtime/browser/run-browser-diagnostics.cjs

'use strict';

const { attachBrowserSession } = require('./attach-browser-session.cjs');
const { collectBrowserArtifacts } = require('./collect-browser-artifacts.cjs');
const { normalizeBrowserResult } = require('./normalize-browser-result.cjs');
const { writeBrowserArtifacts } = require('./write-browser-artifacts.cjs');

async function closeClientQuietly(client) {
  if (!client || typeof client.close !== 'function') {
    return;
  }

  try {
    await client.close();
  } catch (_) {
    // close errors must not mask diagnostics result
  }
}

async function runBrowserDiagnostics(input = {}, io = {}) {
  const attachResult = await attachBrowserSession(input);

  let collectResult = {
    status: 'failed',
    target: null,
    artifacts: {},
    counts: {
      consoleMessages: 0,
      consoleErrors: 0,
      pageErrors: 0,
      failedRequests: 0,
    },
    warnings: [],
    error: {
      code: 'attach_required',
      message: 'Diagnostics collection was skipped because attach did not succeed.',
    },
  };

  if (attachResult.status === 'ok') {
    collectResult = await collectBrowserArtifacts(attachResult, input);
  }

  const normalizedResult = normalizeBrowserResult({
    goal: typeof input.goal === 'string' && input.goal.trim() ? input.goal.trim() : 'browser-diagnostics',
    mode: typeof input.mode === 'string' && input.mode.trim() ? input.mode.trim() : 'safe',
    attachResult,
    collectResult,
  });

  const writeResult = await writeBrowserArtifacts(normalizedResult, io);

  await closeClientQuietly(attachResult.session && attachResult.session.client);

  return {
    status: writeResult.status,
    attachResult,
    collectResult,
    normalizedResult,
    writeResult,
  };
}

module.exports = {
  runBrowserDiagnostics,
};
