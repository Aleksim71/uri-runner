// path: src/runtime/browser/collect-browser-diagnostics.cjs
'use strict';

const {
  getBrowserSessionState,
  updateBrowserSessionState
} = require('./browser-session-store.cjs');
const { writeBrowserReport } = require('./write-browser-report.cjs');

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

async function collectBrowserDiagnostics(options) {
  if (!options || typeof options !== 'object') {
    throw new Error('collectBrowserDiagnostics options must be an object.');
  }

  const runtimeContext = options.runtimeContext;
  const sessionId = options.sessionId;
  const baseDir = options.baseDir;

  if (!runtimeContext || typeof runtimeContext !== 'object') {
    throw new Error('collectBrowserDiagnostics runtimeContext is required.');
  }

  if (!isNonEmptyString(sessionId)) {
    throw new Error('collectBrowserDiagnostics sessionId is required.');
  }

  if (!isNonEmptyString(baseDir)) {
    throw new Error('collectBrowserDiagnostics baseDir is required.');
  }

  const session = getBrowserSessionState(runtimeContext, sessionId);

  if (!isNonEmptyString(session.pageUrl)) {
    throw new Error(
      `collectBrowserDiagnostics requires opened pageUrl for session: ${sessionId}`
    );
  }

  const consoleEntries = Array.isArray(options.consoleEntries)
    ? options.consoleEntries
    : [];

  const networkEntries = Array.isArray(options.networkEntries)
    ? options.networkEntries
    : [];

  const pageMeta = {
    title: isNonEmptyString(options.pageTitle)
      ? options.pageTitle.trim()
      : session.pageTitle || null,
    finalUrl: session.pageUrl,
    openedAt:
      session.runtime && typeof session.runtime === 'object'
        ? session.runtime.openedAt || null
        : null,
    readyAt:
      session.runtime && typeof session.runtime === 'object'
        ? session.runtime.readyAt || null
        : null,
    readyState: session.ready ? 'complete' : 'unknown'
  };

  const consoleErrorCount = consoleEntries.filter((entry) => {
    return entry && typeof entry === 'object' && entry.level === 'error';
  }).length;

  const networkFailureCount = networkEntries.filter((entry) => {
    return entry && typeof entry === 'object' && entry.ok === false;
  }).length;

  const summary = {
    target: session.target,
    baseUrl: session.baseUrl,
    finalUrl: session.pageUrl,
    ready: Boolean(session.ready),
    consoleErrorCount,
    networkFailureCount,
    artifacts: {}
  };

  const artifacts = await writeBrowserReport({
    baseDir,
    console: { entries: consoleEntries },
    network: { entries: networkEntries },
    pageMeta,
    summary,
    screenshot: options.screenshot || null
  });

  summary.artifacts = {
    console: artifacts.console || null,
    network: artifacts.network || null,
    pageMeta: artifacts.pageMeta || null,
    summary: artifacts.summary || null,
    screenshot: artifacts.screenshot || null
  };

  if (artifacts.summary) {
    await writeBrowserReport({
      baseDir,
      summary
    });
  }

  const diagnosticsAt = new Date().toISOString();

  const nextState = updateBrowserSessionState(runtimeContext, sessionId, {
    pageTitle: pageMeta.title,
    diagnostics: {
      consoleEntries,
      networkEntries,
      screenshotPath: artifacts.screenshot || null,
      pageMetaPath: artifacts.pageMeta || null,
      summaryPath: artifacts.summary || null
    },
    runtime: {
      diagnosticsAt
    }
  });

  return {
    ok: true,
    sessionId: nextState.sessionId,
    target: nextState.target,
    pageUrl: nextState.pageUrl,
    diagnosticsAt,
    consoleErrorCount,
    networkFailureCount,
    artifacts
  };
}

module.exports = {
  collectBrowserDiagnostics
};
