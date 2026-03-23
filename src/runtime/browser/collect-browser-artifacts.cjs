// path: src/runtime/browser/collect-browser-artifacts.cjs

'use strict';

function normalizeCollectOptions(options = {}) {
  const collect = options.collect && typeof options.collect === 'object' ? options.collect : {};

  return {
    collect: {
      metadata: collect.metadata !== false,
      screenshot: collect.screenshot !== false,
      console: collect.console !== false,
      errors: collect.errors !== false,
      fullPageScreenshot: Boolean(collect.fullPageScreenshot),
      dom: Boolean(collect.dom),
      networkSummary: Boolean(collect.networkSummary),
    },
    timeoutMs: Number.isFinite(options.timeoutMs) ? options.timeoutMs : 10_000,
    consoleSettleMs: Number.isFinite(options.consoleSettleMs) ? options.consoleSettleMs : 150,
    networkSettleMs: Number.isFinite(options.networkSettleMs) ? options.networkSettleMs : 250,
  };
}

function buildFailedResult(code, message, warnings = []) {
  return {
    status: 'failed',
    target: null,
    artifacts: {
      pageMetadata: null,
      screenshot: null,
      console: null,
      errors: null,
      fullPageScreenshot: null,
      dom: null,
      networkSummary: null,
    },
    counts: {
      consoleMessages: 0,
      consoleErrors: 0,
      pageErrors: 0,
      totalRequests: 0,
      failedRequests: 0,
    },
    warnings: Array.isArray(warnings) ? warnings : [],
    error: {
      code,
      message,
    },
  };
}

function ensureBuffer(value) {
  if (Buffer.isBuffer(value)) {
    return value;
  }

  if (typeof value === 'string') {
    return Buffer.from(value, 'base64');
  }

  if (value instanceof Uint8Array) {
    return Buffer.from(value);
  }

  return null;
}

function enrichMetadata(rawMetadata, session = {}) {
  const metadata = rawMetadata && typeof rawMetadata === 'object' ? { ...rawMetadata } : {};

  if (!metadata.endpoint) {
    metadata.endpoint = session.endpoint || null;
  }

  if (!metadata.targetId) {
    metadata.targetId = session.targetId || null;
  }

  if (!metadata.url) {
    metadata.url = session.targetUrl || null;
  }

  if (!metadata.title) {
    metadata.title = session.targetTitle || null;
  }

  if (!metadata.type) {
    metadata.type = session.targetType || 'page';
  }

  if (!metadata.browserType) {
    metadata.browserType = session.browserType || 'unknown';
  }

  return metadata;
}

function normalizeConsoleMessages(items) {
  const safeItems = Array.isArray(items) ? items : [];

  return safeItems.map((item) => ({
    source: item && item.source ? item.source : 'runtime.console',
    type: item && item.type ? item.type : 'log',
    level: item && item.level ? item.level : 'log',
    text: item && typeof item.text === 'string' ? item.text : '',
    args: item && Array.isArray(item.args) ? item.args : [],
    url: item && item.url ? item.url : null,
    timestamp: item && item.timestamp ? item.timestamp : null,
  }));
}

function normalizePageErrors(items) {
  const safeItems = Array.isArray(items) ? items : [];

  return safeItems.map((item) => ({
    source: item && item.source ? item.source : 'runtime.exception',
    type: item && item.type ? item.type : 'error',
    level: item && item.level ? item.level : 'error',
    text: item && typeof item.text === 'string' ? item.text : 'Unknown page error.',
    url: item && item.url ? item.url : null,
    lineNumber: item && Number.isFinite(item.lineNumber) ? item.lineNumber : null,
    columnNumber: item && Number.isFinite(item.columnNumber) ? item.columnNumber : null,
    timestamp: item && item.timestamp ? item.timestamp : null,
  }));
}

function normalizeNetworkSummary(summary) {
  const safeSummary = summary && typeof summary === 'object' ? summary : {};
  const requests = Array.isArray(safeSummary.requests) ? safeSummary.requests : [];

  return {
    requests: requests.map((request) => ({
      requestId: request && request.requestId ? request.requestId : null,
      url: request && typeof request.url === 'string' ? request.url : '',
      method: request && request.method ? request.method : 'GET',
      resourceType: request && request.resourceType ? request.resourceType : 'Other',
      status: request && Number.isFinite(request.status) ? request.status : null,
      mimeType: request && request.mimeType ? request.mimeType : null,
      protocol: request && request.protocol ? request.protocol : null,
      encodedDataLength:
        request && Number.isFinite(request.encodedDataLength) ? request.encodedDataLength : null,
      failed: Boolean(request && request.failed),
      failureText: request && request.failureText ? request.failureText : null,
      timestamp: request && request.timestamp ? request.timestamp : null,
    })),
    totalRequests: Number.isFinite(safeSummary.totalRequests)
      ? safeSummary.totalRequests
      : requests.length,
    failedRequests: Number.isFinite(safeSummary.failedRequests) ? safeSummary.failedRequests : 0,
    statusCodeBuckets:
      safeSummary.statusCodeBuckets && typeof safeSummary.statusCodeBuckets === 'object'
        ? safeSummary.statusCodeBuckets
        : {},
    resourceTypeBuckets:
      safeSummary.resourceTypeBuckets && typeof safeSummary.resourceTypeBuckets === 'object'
        ? safeSummary.resourceTypeBuckets
        : {},
  };
}

async function collectBrowserArtifacts(sessionResult, options = {}) {
  if (!sessionResult || sessionResult.status !== 'ok' || !sessionResult.session) {
    return buildFailedResult(
      'attach_required',
      'A successful attach result is required before collecting browser artifacts.'
    );
  }

  const { session } = sessionResult;
  const client = session.client;

  if (!client || typeof client !== 'object') {
    return buildFailedResult(
      'client_required',
      'Attached browser session does not expose a diagnostics client.'
    );
  }

  const normalizedOptions = normalizeCollectOptions(options);
  const warnings = [];
  const artifacts = {
    pageMetadata: null,
    screenshot: null,
    console: null,
    errors: null,
    fullPageScreenshot: null,
    dom: null,
    networkSummary: null,
  };

  try {
    if (normalizedOptions.collect.metadata) {
      if (typeof client.getPageMetadata !== 'function') {
        warnings.push('Diagnostics client does not support getPageMetadata().');
      } else {
        const metadata = await client.getPageMetadata();
        artifacts.pageMetadata = {
          kind: 'json',
          data: enrichMetadata(metadata, session),
        };
      }
    }

    if (normalizedOptions.collect.screenshot) {
      if (typeof client.takeScreenshot !== 'function') {
        warnings.push('Diagnostics client does not support takeScreenshot().');
      } else {
        const screenshotData = await client.takeScreenshot({ fullPage: false });
        const buffer = ensureBuffer(screenshotData);

        if (buffer && buffer.length > 0) {
          artifacts.screenshot = {
            kind: 'binary',
            ext: '.png',
            data: buffer,
          };
        } else {
          warnings.push('Diagnostics client returned an invalid screenshot payload.');
        }
      }
    }

    let consoleMessages = [];
    let pageErrors = [];
    let networkSummary = null;
    const wantsConsoleData = normalizedOptions.collect.console || normalizedOptions.collect.errors;

    if (wantsConsoleData && !artifacts.pageMetadata) {
      warnings.push('Console collection is enabled before metadata was collected.');
    }

    if (wantsConsoleData && typeof client.getConsoleSnapshot === 'function') {
      const snapshot = await client.getConsoleSnapshot({ settleMs: normalizedOptions.consoleSettleMs });
      consoleMessages = normalizeConsoleMessages(snapshot && snapshot.consoleMessages);
      pageErrors = normalizePageErrors(snapshot && snapshot.pageErrors);
    } else {
      if (normalizedOptions.collect.console) {
        if (typeof client.getConsoleMessages !== 'function') {
          warnings.push('Diagnostics client does not support getConsoleMessages().');
        } else {
          const rawMessages = await client.getConsoleMessages({ settleMs: normalizedOptions.consoleSettleMs });
          consoleMessages = normalizeConsoleMessages(rawMessages);
        }
      }

      if (normalizedOptions.collect.errors) {
        if (typeof client.getPageErrors === 'function') {
          const rawErrors = await client.getPageErrors({ settleMs: normalizedOptions.consoleSettleMs });
          pageErrors = normalizePageErrors(rawErrors);
        } else {
          pageErrors = consoleMessages.filter((item) => item && item.level === 'error');
          warnings.push('Diagnostics client does not support getPageErrors(); console errors were used.');
        }
      }
    }

    if (normalizedOptions.collect.console) {
      artifacts.console = {
        kind: 'json',
        data: consoleMessages,
      };
    }

    if (normalizedOptions.collect.errors) {
      artifacts.errors = {
        kind: 'json',
        data: pageErrors,
      };
    }

    if (normalizedOptions.collect.networkSummary) {
      if (typeof client.getNetworkSummary !== 'function') {
        warnings.push('Diagnostics client does not support getNetworkSummary().');
      } else {
        networkSummary = normalizeNetworkSummary(
          await client.getNetworkSummary({ settleMs: normalizedOptions.networkSettleMs })
        );
        artifacts.networkSummary = {
          kind: 'json',
          data: networkSummary,
        };
      }
    }

    const consoleData = artifacts.console ? artifacts.console.data : [];
    const errorsData = artifacts.errors ? artifacts.errors.data : [];
    const failedRequests = networkSummary ? networkSummary.failedRequests : 0;
    const totalRequests = networkSummary ? networkSummary.totalRequests : 0;

    const status =
      warnings.length > 0 ||
      (Array.isArray(errorsData) && errorsData.length > 0) ||
      failedRequests > 0
        ? 'warning'
        : 'ok';

    return {
      status,
      target: {
        url: session.targetUrl || null,
        title: session.targetTitle || null,
      },
      artifacts,
      counts: {
        consoleMessages: Array.isArray(consoleData) ? consoleData.length : 0,
        consoleErrors: Array.isArray(consoleData)
          ? consoleData.filter((item) => item && item.level === 'error').length
          : 0,
        pageErrors: Array.isArray(errorsData) ? errorsData.length : 0,
        totalRequests,
        failedRequests,
      },
      warnings,
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown browser collection error.';
    return buildFailedResult('collect_failed', message, warnings);
  }
}

module.exports = {
  collectBrowserArtifacts,
};
