// path: src/runtime/browser/attach-browser-session.cjs

'use strict';

const { createCdpClientAdapter } = require('./cdp-client.cjs');

function withTimeout(promise, timeoutMs, timeoutMessage) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return Promise.resolve(promise);
  }

  return Promise.race([
    Promise.resolve(promise),
    new Promise((_, reject) => {
      const timer = setTimeout(() => {
        clearTimeout(timer);
        reject(new Error(timeoutMessage));
      }, timeoutMs);
    }),
  ]);
}

function selectTarget(targets, targetHint = {}) {
  const safeTargets = Array.isArray(targets) ? targets.filter(Boolean) : [];

  if (safeTargets.length === 0) {
    return null;
  }

  const pageTargets = safeTargets.filter((target) => {
    const type = typeof target.type === 'string' ? target.type : 'page';
    return type === 'page' || type === 'tab';
  });

  const candidates = pageTargets.length > 0 ? pageTargets : safeTargets;
  const { urlIncludes, titleIncludes } = targetHint || {};

  if (!urlIncludes && !titleIncludes) {
    return candidates[0] || null;
  }

  return (
    candidates.find((target) => {
      const url = typeof target.url === 'string' ? target.url : '';
      const title = typeof target.title === 'string' ? target.title : '';
      const urlMatch = !urlIncludes || url.includes(urlIncludes);
      const titleMatch = !titleIncludes || title.includes(titleIncludes);

      return urlMatch && titleMatch;
    }) || null
  );
}

function buildFailedResult(code, message, warnings = []) {
  return {
    status: 'failed',
    session: null,
    warnings: Array.isArray(warnings) ? warnings : [],
    error: {
      code,
      message,
    },
  };
}

function resolveAdapter(input = {}) {
  if (input.adapter && typeof input.adapter === 'object') {
    return input.adapter;
  }

  if (typeof input.adapterFactory === 'function') {
    return input.adapterFactory(input);
  }

  return createCdpClientAdapter();
}

function resolveEndpoint(input = {}) {
  const endpoint =
    typeof input.endpoint === 'string' ? input.endpoint.trim() : '';

  if (endpoint) {
    return endpoint;
  }

  const host = typeof input.host === 'string' ? input.host.trim() : '';
  const port =
    input.port === undefined || input.port === null
      ? ''
      : String(input.port).trim();

  if (host && port) {
    return `http://${host}:${port}`;
  }

  return '';
}

async function attachBrowserSession(input = {}) {
  const endpoint = resolveEndpoint(input);
  const browserType =
    typeof input.browserType === 'string' && input.browserType.trim()
      ? input.browserType.trim()
      : 'unknown';
  const targetHint = input.targetHint && typeof input.targetHint === 'object' ? input.targetHint : {};
  const timeoutMs = Number.isFinite(input.timeoutMs) ? input.timeoutMs : 10_000;
  const allowCreateTarget = Boolean(input.allowCreateTarget);
  const warnings = [];

  if (!endpoint) {
    return buildFailedResult('endpoint_required', 'Browser diagnostics endpoint is required.');
  }

  let adapter;

  try {
    adapter = resolveAdapter(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown browser adapter error.';
    return buildFailedResult('adapter_invalid', message);
  }

  if (!adapter || typeof adapter !== 'object') {
    return buildFailedResult(
      'adapter_required',
      'Browser diagnostics adapter is required for attach-browser-session.'
    );
  }

  if (typeof adapter.listTargets !== 'function') {
    return buildFailedResult(
      'adapter_invalid',
      'Browser diagnostics adapter must provide listTargets(endpoint).'
    );
  }

  try {
    const targets = await withTimeout(
      adapter.listTargets(endpoint),
      timeoutMs,
      `Browser attach timed out while listing targets after ${timeoutMs}ms.`
    );

    let target = selectTarget(targets, targetHint);

    if (!target && allowCreateTarget && typeof adapter.createTarget === 'function') {
      target = await withTimeout(
        adapter.createTarget(endpoint, targetHint),
        timeoutMs,
        `Browser attach timed out while creating target after ${timeoutMs}ms.`
      );

      if (target) {
        warnings.push('Target was created during attach because no matching target existed.');
      }
    }

    if (!target) {
      return buildFailedResult(
        'target_not_found',
        'No browser target matched the provided targetHint.',
        warnings
      );
    }

    let client = null;

    if (typeof adapter.attachToTarget === 'function') {
      client = await withTimeout(
        adapter.attachToTarget(endpoint, target),
        timeoutMs,
        `Browser attach timed out while attaching to target after ${timeoutMs}ms.`
      );
    }

    return {
      status: 'ok',
      session: {
        browserType,
        endpoint,
        targetId: target.id || null,
        targetUrl: target.url || null,
        targetTitle: target.title || null,
        targetType: target.type || 'page',
        client: client || null,
        target,
      },
      warnings,
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown browser attach error.';
    const code =
      typeof message === 'string' && message.toLowerCase().includes('timed out')
        ? 'timeout'
        : 'attach_failed';

    return buildFailedResult(code, message, warnings);
  }
}

module.exports = {
  attachBrowserSession,
};
