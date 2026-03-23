// path: src/runtime/browser/normalize-browser-result.cjs

'use strict';

function buildBrowserReport(input = {}) {
  const summary = input.summary || {};
  const artifacts = Array.isArray(input.artifacts) ? input.artifacts : [];

  return {
    kind: 'browser-report',
    goal: input.goal || 'browser-diagnostics',
    mode: input.mode || 'safe',
    status: input.status || 'failed',
    attachStatus: summary.attachStatus || 'failed',
    targetUrl: summary.targetUrl || null,
    targetTitle: summary.targetTitle || null,
    consoleErrorCount: Number.isFinite(summary.consoleErrorCount) ? summary.consoleErrorCount : 0,
    pageErrorCount: Number.isFinite(summary.pageErrorCount) ? summary.pageErrorCount : 0,
    artifactCount: artifacts.length,
    artifactNames: artifacts.map((artifact) => artifact.name),
    warnings: Array.isArray(input.warnings) ? input.warnings : [],
    errors: Array.isArray(input.errors) ? input.errors : [],
  };
}

function pushJsonArtifact(bucket, name, value) {
  bucket.push({
    name,
    kind: 'json',
    payload: value,
  });
}

function pushBinaryArtifact(bucket, name, value) {
  bucket.push({
    name,
    kind: 'binary',
    payload: value,
  });
}

function normalizeBrowserResult(input = {}) {
  const attachResult = input.attachResult && typeof input.attachResult === 'object' ? input.attachResult : {};
  const collectResult = input.collectResult && typeof input.collectResult === 'object' ? input.collectResult : {};
  const goal = typeof input.goal === 'string' && input.goal.trim() ? input.goal.trim() : 'browser-diagnostics';
  const mode = typeof input.mode === 'string' && input.mode.trim() ? input.mode.trim() : 'safe';

  const warnings = [
    ...(Array.isArray(attachResult.warnings) ? attachResult.warnings : []),
    ...(Array.isArray(collectResult.warnings) ? collectResult.warnings : []),
  ];

  const errors = [];
  if (attachResult.error) {
    errors.push(attachResult.error);
  }
  if (collectResult.error) {
    errors.push(collectResult.error);
  }

  const attachStatus = attachResult.status || 'failed';
  const collectStatus = collectResult.status || 'failed';

  let status = 'ok';
  if (attachStatus !== 'ok' || collectStatus === 'failed') {
    status = 'failed';
  } else if (collectStatus === 'warning' || warnings.length > 0) {
    status = 'warning';
  }

  const targetUrl =
    (collectResult.target && collectResult.target.url) ||
    (attachResult.session && attachResult.session.targetUrl) ||
    null;
  const targetTitle =
    (collectResult.target && collectResult.target.title) ||
    (attachResult.session && attachResult.session.targetTitle) ||
    null;

  const counts = collectResult.counts && typeof collectResult.counts === 'object' ? collectResult.counts : {};
  const artifacts = [];
  const collectArtifacts =
    collectResult.artifacts && typeof collectResult.artifacts === 'object' ? collectResult.artifacts : {};

  if (collectArtifacts.pageMetadata && collectArtifacts.pageMetadata.data) {
    pushJsonArtifact(artifacts, 'page-metadata.json', collectArtifacts.pageMetadata.data);
  }

  if (collectArtifacts.screenshot && collectArtifacts.screenshot.data) {
    pushBinaryArtifact(artifacts, 'screenshot.png', collectArtifacts.screenshot.data);
  }

  if (collectArtifacts.console) {
    pushJsonArtifact(artifacts, 'console.json', collectArtifacts.console.data || []);
  }

  if (collectArtifacts.errors) {
    pushJsonArtifact(artifacts, 'errors.json', collectArtifacts.errors.data || []);
  }

  const summary = {
    targetUrl,
    targetTitle,
    attachStatus,
    collectStatus,
    consoleMessageCount: Number.isFinite(counts.consoleMessages) ? counts.consoleMessages : 0,
    consoleErrorCount: Number.isFinite(counts.consoleErrors) ? counts.consoleErrors : 0,
    pageErrorCount: Number.isFinite(counts.pageErrors) ? counts.pageErrors : 0,
    failedRequestCount: Number.isFinite(counts.failedRequests) ? counts.failedRequests : 0,
    artifactCount: artifacts.length,
  };

  const browserReport = buildBrowserReport({
    goal,
    mode,
    status,
    summary,
    artifacts,
    warnings,
    errors,
  });

  pushJsonArtifact(artifacts, 'browser-report.json', browserReport);

  summary.artifactCount = artifacts.length;

  return {
    kind: 'browser-diagnostics',
    status,
    goal,
    mode,
    summary,
    artifacts,
    warnings,
    errors,
  };
}

module.exports = {
  normalizeBrowserResult,
};
