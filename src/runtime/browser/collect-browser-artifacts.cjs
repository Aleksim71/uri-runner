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

    if (normalizedOptions.collect.console) {
      if (!artifacts.pageMetadata) {
        warnings.push('Console collection is enabled before metadata was collected.');
      }

      if (typeof client.getConsoleMessages !== 'function') {
        warnings.push('Diagnostics client does not support getConsoleMessages().');
      } else {
        consoleMessages = await client.getConsoleMessages();
        const safeConsoleMessages = Array.isArray(consoleMessages) ? consoleMessages : [];
        artifacts.console = {
          kind: 'json',
          data: safeConsoleMessages,
        };
      }
    }

    if (normalizedOptions.collect.errors) {
      if (typeof client.getPageErrors === 'function') {
        const pageErrors = await client.getPageErrors();
        artifacts.errors = {
          kind: 'json',
          data: Array.isArray(pageErrors) ? pageErrors : [],
        };
      } else {
        const fallbackErrors = Array.isArray(consoleMessages)
          ? consoleMessages.filter((item) => item && item.level === 'error')
          : [];

        artifacts.errors = {
          kind: 'json',
          data: fallbackErrors,
        };

        warnings.push('Diagnostics client does not support getPageErrors(); console errors were used.');
      }
    }

    const consoleData = artifacts.console ? artifacts.console.data : [];
    const errorsData = artifacts.errors ? artifacts.errors.data : [];
    const failedRequests = 0;

    const status =
      warnings.length > 0 || (Array.isArray(errorsData) && errorsData.length > 0) ? 'warning' : 'ok';

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
