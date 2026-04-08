'use strict';

const {
  createBrowserSessionState,
  updateBrowserSessionState
} = require('./browser-session-store.cjs');
const { attachBrowserSession } = require('./attach-browser-session.cjs');

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function resolveEndpoint(options = {}) {
  const input = options.input && typeof options.input === 'object' ? options.input : {};
  const environment =
    options.environment && typeof options.environment === 'object'
      ? options.environment
      : {};

  return (
    (isNonEmptyString(input.endpoint) && input.endpoint.trim()) ||
    (isNonEmptyString(environment.endpoint) && environment.endpoint.trim()) ||
    process.env.BROWSER_ENDPOINT ||
    process.env.CDP_ENDPOINT ||
    process.env.CHROME_REMOTE_DEBUGGING_URL ||
    null
  );
}

function buildTargetHint(options = {}) {
  const input = options.input && typeof options.input === 'object' ? options.input : {};
  const environment =
    options.environment && typeof options.environment === 'object'
      ? options.environment
      : {};

  const urlSource =
    (isNonEmptyString(input.url) && input.url.trim()) ||
    (isNonEmptyString(input.baseUrl) && input.baseUrl.trim()) ||
    (isNonEmptyString(environment.baseUrl) && environment.baseUrl.trim()) ||
    null;

  return {
    urlIncludes: urlSource,
    titleIncludes: null,
  };
}

function createFallbackPageAdapter(baseUrl = null) {
  let currentUrl = isNonEmptyString(baseUrl) ? baseUrl.trim() : null;

  return {
    async goto(url) {
      const finalUrl = isNonEmptyString(url) ? url.trim() : currentUrl;
      currentUrl = finalUrl || currentUrl;

      return {
        ok: true,
        finalUrl: currentUrl,
        url: currentUrl,
      };
    },

    async title() {
      return null;
    },

    url() {
      return currentUrl;
    },

    _fallback: true,
  };
}

function createPageAdapter(attachedSession) {
  const client = attachedSession && attachedSession.client ? attachedSession.client : null;
  const rawClient =
    client && client.rawClient && typeof client.rawClient === 'object'
      ? client.rawClient
      : null;
  const targetUrl =
    attachedSession && typeof attachedSession.targetUrl === 'string'
      ? attachedSession.targetUrl
      : null;

  if (!client || typeof client !== 'object') {
    return null;
  }

  return {
    async goto(url) {
      if (typeof client.goto === 'function') {
        return client.goto(url);
      }

      if (typeof client.navigate === 'function') {
        return client.navigate(url);
      }

      if (typeof client.open === 'function') {
        return client.open(url);
      }

      if (client.Page && typeof client.Page.navigate === 'function') {
        return client.Page.navigate({ url });
      }

      if (rawClient && rawClient.Page && typeof rawClient.Page.navigate === 'function') {
        return rawClient.Page.navigate({ url });
      }

      throw new Error(
        'Attached browser client does not expose goto/navigate/open/Page.navigate.'
      );
    },

    async title() {
      if (typeof client.title === 'function') {
        return client.title();
      }

      if (typeof client.getTitle === 'function') {
        return client.getTitle();
      }

      if (typeof client.getPageMetadata === 'function') {
        const meta = await client.getPageMetadata();
        return meta && typeof meta.title === 'string' ? meta.title : null;
      }

      return null;
    },

    url() {
      if (typeof client.url === 'function') {
        return client.url();
      }

      return targetUrl || null;
    },

    _client: client,
    _rawClient: rawClient,
  };
}

async function startBrowserSession(options) {
  if (!options || typeof options !== 'object') {
    throw new Error('startBrowserSession options must be an object.');
  }

  const runtimeContext = options.runtimeContext;
  const environment = options.environment;

  if (!runtimeContext || typeof runtimeContext !== 'object') {
    throw new Error('startBrowserSession runtimeContext is required.');
  }

  if (!environment || typeof environment !== 'object') {
    throw new Error('startBrowserSession environment is required.');
  }

  const session = createBrowserSessionState(runtimeContext, {
    sessionId: options.sessionId,
    target: environment.target,
    kind: environment.kind,
    source: environment.source,
    baseUrl: environment.baseUrl
  });

  const endpoint = resolveEndpoint(options);
  let attached = null;
  let page = null;

  if (isNonEmptyString(endpoint)) {
    const attachResult = await attachBrowserSession({
      endpoint,
      browserType: environment.kind || 'web',
      targetHint: buildTargetHint(options),
      allowCreateTarget: true,
      timeoutMs: 10_000,
    });

    if (attachResult && attachResult.status === 'ok' && attachResult.session) {
      attached = attachResult.session;
      page = createPageAdapter(attached);
    } else if (attachResult && attachResult.error) {
      throw new Error(
        `Browser attach failed: ${attachResult.error.code}: ${attachResult.error.message}`
      );
    }
  }

  if (!page) {
    page = createFallbackPageAdapter(session.baseUrl);
  }

  const nextState = updateBrowserSessionState(runtimeContext, session.sessionId, {
    runtime: {
      endpoint: endpoint || null,
      attachedSession: attached,
      client: attached && attached.client ? attached.client : null,
      page: page || null,
      attachedAt: attached ? new Date().toISOString() : null,
    }
  });

  return {
    ok: true,
    sessionId: nextState.sessionId,
    target: nextState.target,
    kind: nextState.kind,
    source: nextState.source,
    baseUrl: nextState.baseUrl,
    startedAt: nextState.startedAt,
    endpoint: endpoint || null,
    attached: Boolean(attached),
  };
}

module.exports = {
  startBrowserSession
};
