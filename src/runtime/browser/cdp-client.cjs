// path: src/runtime/browser/cdp-client.cjs

'use strict';

const CDP = require('chrome-remote-interface');
const { URL } = require('node:url');

function normalizeCdpEndpoint(endpoint = '') {
  const raw = typeof endpoint === 'string' ? endpoint.trim() : '';

  if (!raw) {
    throw new Error('CDP endpoint is required.');
  }

  const normalized = /^(ws|wss|http|https):\/\//i.test(raw) ? raw : `http://${raw}`;
  const url = new URL(normalized);
  const secure = url.protocol === 'https:' || url.protocol === 'wss:';
  const port = Number(url.port || (secure ? 443 : 80));
  const websocketUrl = url.protocol === 'ws:' || url.protocol === 'wss:' ? raw : null;

  return {
    raw,
    normalized,
    protocol: url.protocol,
    host: url.hostname,
    port,
    secure,
    websocketUrl,
  };
}

function mapTarget(target = {}) {
  return {
    id: target.id || target.targetId || target.targetID || null,
    type: target.type || 'page',
    title: target.title || '',
    url: target.url || '',
    description: target.description || '',
    webSocketDebuggerUrl: target.webSocketDebuggerUrl || null,
  };
}

function serializeRemoteObject(remoteObject = {}) {
  if (remoteObject && Object.prototype.hasOwnProperty.call(remoteObject, 'value')) {
    return remoteObject.value;
  }

  if (typeof remoteObject.description === 'string') {
    return remoteObject.description;
  }

  return null;
}

async function safeDomainCall(domain, methodName, ...args) {
  if (!domain || typeof domain[methodName] !== 'function') {
    return null;
  }

  return domain[methodName](...args);
}

async function safeRuntimeEvaluateFromDomain(Runtime, expression) {
  const result = await safeDomainCall(Runtime, 'evaluate', {
    expression,
    returnByValue: true,
  });

  if (!result || !result.result) {
    return null;
  }

  return serializeRemoteObject(result.result);
}

function selectPageTarget(targets, targetHint = {}) {
  const safeTargets = Array.isArray(targets) ? targets.map(mapTarget).filter(Boolean) : [];
  const pageTargets = safeTargets.filter((target) => target.type === 'page' || target.type === 'tab');
  const candidates = pageTargets.length > 0 ? pageTargets : safeTargets;

  if (candidates.length === 0) {
    return null;
  }

  const { urlIncludes, titleIncludes, targetId } = targetHint || {};

  if (targetId) {
    const byId = candidates.find((target) => target.id === targetId);
    if (byId) {
      return byId;
    }
  }

  return (
    candidates.find((target) => {
      const url = typeof target.url === 'string' ? target.url : '';
      const title = typeof target.title === 'string' ? target.title : '';
      const urlMatch = !urlIncludes || url.includes(urlIncludes);
      const titleMatch = !titleIncludes || title.includes(titleIncludes);

      return urlMatch && titleMatch;
    }) || candidates[0]
  );
}

function sleep(ms) {
  if (!Number.isFinite(ms) || ms <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout(promise, label, ms = 3_000) {
  if (!Number.isFinite(ms) || ms <= 0) {
    return Promise.resolve(promise);
  }

  return Promise.race([
    Promise.resolve(promise),
    new Promise((_, reject) => {
      const timer = setTimeout(() => {
        clearTimeout(timer);
        reject(new Error(`${label} timeout after ${ms}ms`));
      }, ms);
    }),
  ]);
}

function mapConsoleTypeToLevel(type = '') {
  switch (type) {
    case 'error':
    case 'assert':
      return 'error';
    case 'warning':
    case 'warn':
      return 'warning';
    case 'debug':
      return 'debug';
    case 'info':
      return 'info';
    default:
      return 'log';
  }
}

function normalizeConsoleEntry(entry = {}) {
  return {
    source: entry.source || 'runtime.console',
    type: entry.type || 'log',
    level: entry.level || mapConsoleTypeToLevel(entry.type),
    text: typeof entry.text === 'string' ? entry.text : '',
    args: Array.isArray(entry.args) ? entry.args : [],
    url: entry.url || null,
    timestamp: entry.timestamp || null,
  };
}

function normalizePageError(entry = {}) {
  return {
    source: entry.source || 'runtime.exception',
    type: entry.type || 'error',
    level: entry.level || 'error',
    text: typeof entry.text === 'string' ? entry.text : 'Unknown page error.',
    url: entry.url || null,
    lineNumber: Number.isFinite(entry.lineNumber) ? entry.lineNumber : null,
    columnNumber: Number.isFinite(entry.columnNumber) ? entry.columnNumber : null,
    timestamp: entry.timestamp || null,
  };
}

function normalizeNetworkRecord(record = {}) {
  return {
    requestId: record.requestId || null,
    url: typeof record.url === 'string' ? record.url : '',
    method: record.method || 'GET',
    resourceType: record.resourceType || 'Other',
    status: Number.isFinite(record.status) ? record.status : null,
    mimeType: record.mimeType || null,
    protocol: record.protocol || null,
    encodedDataLength: Number.isFinite(record.encodedDataLength) ? record.encodedDataLength : null,
    failed: Boolean(record.failed),
    failureText: record.failureText || null,
    timestamp: record.timestamp || null,
  };
}

function buildNetworkSummary(networkRecords) {
  const requests = Array.from(networkRecords.values()).map((record) => normalizeNetworkRecord(record));
  const statusCodeBuckets = {};
  const resourceTypeBuckets = {};
  let failedRequests = 0;

  for (const request of requests) {
    const resourceType = request.resourceType || 'Other';
    resourceTypeBuckets[resourceType] = (resourceTypeBuckets[resourceType] || 0) + 1;

    if (Number.isFinite(request.status)) {
      const bucket = String(request.status);
      statusCodeBuckets[bucket] = (statusCodeBuckets[bucket] || 0) + 1;
    }

    if (request.failed) {
      failedRequests += 1;
    }
  }

  return {
    requests,
    totalRequests: requests.length,
    failedRequests,
    statusCodeBuckets,
    resourceTypeBuckets,
  };
}

async function safeRuntimeEvaluate(send, expression) {
  const result = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
  });

  if (!result || !result.result) {
    return null;
  }

  return serializeRemoteObject(result.result);
}

function createBufferedClientLegacy(rawClient, target = {}, endpoint = '') {
  const Runtime = rawClient.Runtime || null;
  const Page = rawClient.Page || null;
  const Log = rawClient.Log || null;
  const Network = rawClient.Network || null;
  const consoleMessages = [];
  const pageErrors = [];
  const networkRecords = new Map();

  if (Runtime && typeof Runtime.consoleAPICalled === 'function') {
    Runtime.consoleAPICalled((event = {}) => {
      const args = Array.isArray(event.args) ? event.args.map(serializeRemoteObject) : [];
      consoleMessages.push(
        normalizeConsoleEntry({
          source: 'runtime.console',
          type: event.type || 'log',
          text: args.filter((value) => value !== null).join(' '),
          args,
          timestamp: event.timestamp || null,
        })
      );
    });
  }

  if (Runtime && typeof Runtime.exceptionThrown === 'function') {
    Runtime.exceptionThrown((event = {}) => {
      const details = event.exceptionDetails || {};
      pageErrors.push(
        normalizePageError({
          source: 'runtime.exception',
          text: details.text || (details.exception && details.exception.description) || 'Runtime exception thrown.',
          url: details.url || null,
          lineNumber: Number.isFinite(details.lineNumber) ? details.lineNumber : null,
          columnNumber: Number.isFinite(details.columnNumber) ? details.columnNumber : null,
          timestamp: event.timestamp || null,
        })
      );
    });
  }

  if (Log && typeof Log.entryAdded === 'function') {
    Log.entryAdded((event = {}) => {
      const entry = event.entry || {};
      const normalized = normalizeConsoleEntry({
        source: 'log.entry',
        type: entry.level || 'info',
        level: entry.level || 'info',
        text: entry.text || '',
        url: entry.url || null,
        timestamp: entry.timestamp || null,
      });

      consoleMessages.push(normalized);

      if (normalized.level === 'error') {
        pageErrors.push(
          normalizePageError({
            source: 'log.entry',
            text: normalized.text,
            url: normalized.url,
            timestamp: normalized.timestamp,
          })
        );
      }
    });
  }

  if (Network && typeof Network.requestWillBeSent === 'function') {
    Network.requestWillBeSent((event = {}) => {
      const requestId = event.requestId || null;
      if (!requestId) {
        return;
      }

      const previous = networkRecords.get(requestId) || {};
      networkRecords.set(requestId, {
        ...previous,
        requestId,
        url: (event.request && event.request.url) || previous.url || '',
        method: (event.request && event.request.method) || previous.method || 'GET',
        resourceType: event.type || previous.resourceType || 'Other',
        timestamp: event.timestamp || previous.timestamp || null,
      });
    });
  }

  if (Network && typeof Network.responseReceived === 'function') {
    Network.responseReceived((event = {}) => {
      const requestId = event.requestId || null;
      if (!requestId) {
        return;
      }

      const previous = networkRecords.get(requestId) || {};
      const response = event.response || {};
      networkRecords.set(requestId, {
        ...previous,
        requestId,
        url: response.url || previous.url || '',
        method: previous.method || 'GET',
        resourceType: event.type || previous.resourceType || 'Other',
        status: Number.isFinite(response.status) ? response.status : previous.status,
        mimeType: response.mimeType || previous.mimeType || null,
        protocol: response.protocol || previous.protocol || null,
        encodedDataLength: Number.isFinite(response.encodedDataLength)
          ? response.encodedDataLength
          : previous.encodedDataLength || null,
        timestamp: event.timestamp || previous.timestamp || null,
      });
    });
  }

  if (Network && typeof Network.loadingFailed === 'function') {
    Network.loadingFailed((event = {}) => {
      const requestId = event.requestId || null;
      if (!requestId) {
        return;
      }

      const previous = networkRecords.get(requestId) || {};
      networkRecords.set(requestId, {
        ...previous,
        requestId,
        url: previous.url || event.url || '',
        method: previous.method || 'GET',
        resourceType: event.type || previous.resourceType || 'Other',
        failed: true,
        failureText: event.errorText || 'Request failed.',
        timestamp: event.timestamp || previous.timestamp || null,
      });
    });
  }

  return {
    rawClient,
    async getPageMetadata() {
      const userAgent = await safeRuntimeEvaluateFromDomain(Runtime, 'navigator.userAgent');
      const readyState = await safeRuntimeEvaluateFromDomain(Runtime, 'document.readyState');
      const runtimeUrl = await safeRuntimeEvaluateFromDomain(Runtime, 'location.href');
      const runtimeTitle = await safeRuntimeEvaluateFromDomain(Runtime, 'document.title');
      const layoutMetrics = await safeDomainCall(Page, 'getLayoutMetrics');
      const frameTree = await safeDomainCall(Page, 'getFrameTree');

      return {
        endpoint,
        targetId: target.id || null,
        url: runtimeUrl || target.url || null,
        title: runtimeTitle || target.title || null,
        type: target.type || 'page',
        userAgent,
        readyState,
        layoutMetrics: layoutMetrics || null,
        frameTree: frameTree || null,
      };
    },
    async takeScreenshot(options = {}) {
      const fullPage = Boolean(options.fullPage);
      const response = await safeDomainCall(Page, 'captureScreenshot', {
        format: 'png',
        captureBeyondViewport: fullPage,
      });

      return response && typeof response.data === 'string' ? response.data : null;
    },
    async getConsoleSnapshot(options = {}) {
      await sleep(options.settleMs);
      return {
        consoleMessages: consoleMessages.slice(),
        pageErrors: pageErrors.slice(),
      };
    },
    async getConsoleMessages(options = {}) {
      const snapshot = await this.getConsoleSnapshot(options);
      return snapshot.consoleMessages;
    },
    async getPageErrors(options = {}) {
      const snapshot = await this.getConsoleSnapshot(options);
      return snapshot.pageErrors;
    },
    async getNetworkSummary(options = {}) {
      await sleep(options.settleMs);
      return buildNetworkSummary(networkRecords);
    },
    async close() {
      if (typeof rawClient.close === 'function') {
        await rawClient.close();
      }
    },
  };
}

function attachEventCollectors(browserClient, sessionId) {
  const consoleMessages = [];
  const pageErrors = [];
  const networkRecords = new Map();
  const listeners = [];

  const onEvent = (message = {}) => {
    if (!message || message.sessionId !== sessionId || typeof message.method !== 'string') {
      return;
    }

    const params = message.params || {};

    switch (message.method) {
      case 'Runtime.consoleAPICalled': {
        const args = Array.isArray(params.args) ? params.args.map(serializeRemoteObject) : [];
        consoleMessages.push(
          normalizeConsoleEntry({
            source: 'runtime.console',
            type: params.type || 'log',
            text: args.filter((value) => value !== null).join(' '),
            args,
            timestamp: params.timestamp || null,
          })
        );
        break;
      }

      case 'Runtime.exceptionThrown': {
        const details = params.exceptionDetails || {};
        pageErrors.push(
          normalizePageError({
            source: 'runtime.exception',
            text: details.text || (details.exception && details.exception.description) || 'Runtime exception thrown.',
            url: details.url || null,
            lineNumber: Number.isFinite(details.lineNumber) ? details.lineNumber : null,
            columnNumber: Number.isFinite(details.columnNumber) ? details.columnNumber : null,
            timestamp: params.timestamp || null,
          })
        );
        break;
      }

      case 'Log.entryAdded': {
        const entry = params.entry || {};
        const normalized = normalizeConsoleEntry({
          source: 'log.entry',
          type: entry.level || 'info',
          level: entry.level || 'info',
          text: entry.text || '',
          url: entry.url || null,
          timestamp: entry.timestamp || null,
        });

        consoleMessages.push(normalized);

        if (normalized.level === 'error') {
          pageErrors.push(
            normalizePageError({
              source: 'log.entry',
              text: normalized.text,
              url: normalized.url,
              timestamp: normalized.timestamp,
            })
          );
        }
        break;
      }

      case 'Network.requestWillBeSent': {
        const requestId = params.requestId || null;
        if (!requestId) break;

        const previous = networkRecords.get(requestId) || {};
        networkRecords.set(requestId, {
          ...previous,
          requestId,
          url: (params.request && params.request.url) || previous.url || '',
          method: (params.request && params.request.method) || previous.method || 'GET',
          resourceType: params.type || previous.resourceType || 'Other',
          timestamp: params.timestamp || previous.timestamp || null,
        });
        break;
      }

      case 'Network.responseReceived': {
        const requestId = params.requestId || null;
        if (!requestId) break;

        const previous = networkRecords.get(requestId) || {};
        const response = params.response || {};
        networkRecords.set(requestId, {
          ...previous,
          requestId,
          url: response.url || previous.url || '',
          method: previous.method || 'GET',
          resourceType: params.type || previous.resourceType || 'Other',
          status: Number.isFinite(response.status) ? response.status : previous.status,
          mimeType: response.mimeType || previous.mimeType || null,
          protocol: response.protocol || previous.protocol || null,
          encodedDataLength: Number.isFinite(response.encodedDataLength)
            ? response.encodedDataLength
            : previous.encodedDataLength || null,
          timestamp: params.timestamp || previous.timestamp || null,
        });
        break;
      }

      case 'Network.loadingFailed': {
        const requestId = params.requestId || null;
        if (!requestId) break;

        const previous = networkRecords.get(requestId) || {};
        networkRecords.set(requestId, {
          ...previous,
          requestId,
          url: previous.url || params.url || '',
          method: previous.method || 'GET',
          resourceType: params.type || previous.resourceType || 'Other',
          failed: true,
          failureText: params.errorText || 'Request failed.',
          timestamp: params.timestamp || previous.timestamp || null,
        });
        break;
      }

      default:
        break;
    }
  };

  if (browserClient && typeof browserClient.on === 'function') {
    browserClient.on('event', onEvent);
    listeners.push(['event', onEvent]);
  }

  return {
    consoleMessages,
    pageErrors,
    networkRecords,
    detach() {
      if (!browserClient || typeof browserClient.removeListener !== 'function') {
        return;
      }

      for (const [name, listener] of listeners) {
        browserClient.removeListener(name, listener);
      }
    },
  };
}

async function createFlatSession(transport, endpoint, target = {}, options = {}) {
  const connection = normalizeCdpEndpoint(endpoint);
  const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : 3_000;
  const initialUrl = typeof target.url === 'string' && target.url ? target.url : 'about:blank';

  const version = await withTimeout(
    transport.Version({
      host: connection.host,
      port: connection.port,
      secure: connection.secure,
    }),
    'CDP.Version',
    timeoutMs
  );

  const browserWebSocketUrl =
    (version && version.webSocketDebuggerUrl) || connection.websocketUrl || null;

  if (!browserWebSocketUrl) {
    throw new Error('Browser websocket debugger URL is not available.');
  }

  const browserClient = await withTimeout(
    transport({ target: browserWebSocketUrl }),
    'CDP(browser websocket)',
    timeoutMs
  );

  const freshTarget = await withTimeout(
    transport.New({
      host: connection.host,
      port: connection.port,
      secure: connection.secure,
      url: initialUrl,
    }),
    'CDP.New',
    timeoutMs
  );

  const freshTargetId = freshTarget && (freshTarget.id || freshTarget.targetId || freshTarget.targetID);

  if (!freshTargetId) {
    try {
      await browserClient.close();
    } catch (_) {}
    throw new Error('CDP.New did not return a target id.');
  }

  let sessionId = null;

  try {
    const attachResult = await withTimeout(
      browserClient.Target.attachToTarget({
        targetId: freshTargetId,
        flatten: true,
      }),
      'Target.attachToTarget',
      timeoutMs
    );

    sessionId = attachResult && attachResult.sessionId;

    if (!sessionId) {
      throw new Error('Target.attachToTarget did not return a session id.');
    }

    const send = (method, params = {}, perCallTimeoutMs = timeoutMs) =>
      withTimeout(browserClient.send(method, params, sessionId), method, perCallTimeoutMs);

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Log.enable');
    await send('Network.enable');

    return {
      connection,
      browserClient,
      sessionId,
      targetId: freshTargetId,
      version,
      send,
      cleanup: async () => {
        try {
          if (sessionId) {
            await withTimeout(
              browserClient.Target.detachFromTarget({ sessionId }),
              'Target.detachFromTarget',
              Math.min(timeoutMs, 1_500)
            );
          }
        } catch (_) {}

        try {
          await withTimeout(
            transport.Close({
              host: connection.host,
              port: connection.port,
              secure: connection.secure,
              id: freshTargetId,
            }),
            'CDP.Close',
            Math.min(timeoutMs, 1_500)
          );
        } catch (_) {}

        try {
          await withTimeout(browserClient.close(), 'client.close', Math.min(timeoutMs, 1_500));
        } catch (_) {}
      },
    };
  } catch (error) {
    try {
      if (sessionId) {
        await withTimeout(
          browserClient.Target.detachFromTarget({ sessionId }),
          'Target.detachFromTarget',
          Math.min(timeoutMs, 1_500)
        );
      }
    } catch (_) {}

    try {
      await withTimeout(
        transport.Close({
          host: connection.host,
          port: connection.port,
          secure: connection.secure,
          id: freshTargetId,
        }),
        'CDP.Close',
        Math.min(timeoutMs, 1_500)
      );
    } catch (_) {}

    try {
      await withTimeout(browserClient.close(), 'client.close', Math.min(timeoutMs, 1_500));
    } catch (_) {}

    throw error;
  }
}

async function createBufferedClientForFlat(transport, target = {}, endpoint = '', options = {}) {
  const mappedTarget = mapTarget(target);
  const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : 3_000;
  const session = await createFlatSession(transport, endpoint, mappedTarget, { timeoutMs });
  const events = attachEventCollectors(session.browserClient, session.sessionId);

  return {
    rawClient: session.browserClient,
    async getPageMetadata() {
      const userAgent = await safeRuntimeEvaluate(session.send, 'navigator.userAgent');
      const readyState = await safeRuntimeEvaluate(session.send, 'document.readyState');
      const runtimeUrl = await safeRuntimeEvaluate(session.send, 'location.href');
      const runtimeTitle = await safeRuntimeEvaluate(session.send, 'document.title');
      const layoutMetrics = await session.send('Page.getLayoutMetrics');
      const frameTree = await session.send('Page.getFrameTree');

      return {
        endpoint,
        targetId: session.targetId || mappedTarget.id || null,
        url: runtimeUrl || mappedTarget.url || null,
        title: runtimeTitle || mappedTarget.title || null,
        type: mappedTarget.type || 'page',
        userAgent,
        readyState,
        layoutMetrics: layoutMetrics || null,
        frameTree: frameTree || null,
      };
    },
    async takeScreenshot(options = {}) {
      const fullPage = Boolean(options.fullPage);
      const response = await session.send('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: fullPage,
      });

      return response && typeof response.data === 'string' ? response.data : null;
    },
    async getConsoleSnapshot(options = {}) {
      await sleep(options.settleMs);
      return {
        consoleMessages: events.consoleMessages.slice(),
        pageErrors: events.pageErrors.slice(),
      };
    },
    async getConsoleMessages(options = {}) {
      const snapshot = await this.getConsoleSnapshot(options);
      return snapshot.consoleMessages;
    },
    async getPageErrors(options = {}) {
      const snapshot = await this.getConsoleSnapshot(options);
      return snapshot.pageErrors;
    },
    async getNetworkSummary(options = {}) {
      await sleep(options.settleMs);
      return buildNetworkSummary(events.networkRecords);
    },
    async close() {
      events.detach();
      await session.cleanup();
    },
  };
}

function createCdpClientAdapter(options = {}) {
  const transport = options.transport || CDP;
  const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : 3_000;

  if (typeof transport !== 'function') {
    throw new Error('CDP transport must be a callable function.');
  }

  return {
    async listTargets(endpoint) {
      const connection = normalizeCdpEndpoint(endpoint);
      const targets = await transport.List({
        host: connection.host,
        port: connection.port,
        secure: connection.secure,
      });

      return Array.isArray(targets) ? targets.map(mapTarget) : [];
    },

    async listPageTargets(endpoint, targetHint = {}) {
      const targets = await this.listTargets(endpoint);
      const pages = targets.filter((target) => target.type === 'page' || target.type === 'tab');

      if (!targetHint || Object.keys(targetHint).length === 0) {
        return pages;
      }

      const selected = selectPageTarget(pages, targetHint);
      return selected ? [selected, ...pages.filter((target) => target.id !== selected.id)] : pages;
    },

    async createTarget(endpoint, targetHint = {}) {
      const connection = normalizeCdpEndpoint(endpoint);
      const target = await transport.New({
        host: connection.host,
        port: connection.port,
        secure: connection.secure,
        url: typeof targetHint.url === 'string' && targetHint.url ? targetHint.url : 'about:blank',
      });

      return mapTarget(target);
    },

    async attachToTarget(endpoint, target = {}) {
      const mappedTarget = mapTarget(target);

      if (typeof transport.Version === 'function' && typeof transport.New === 'function') {
        return createBufferedClientForFlat(transport, mappedTarget, endpoint, { timeoutMs });
      }

      const connection = normalizeCdpEndpoint(endpoint);
      const targetDescriptor =
        mappedTarget && mappedTarget.id
          ? mappedTarget
          : (typeof target.id === 'string' && target.id ? target.id : null);

      const rawClient = await transport({
        host: connection.host,
        port: connection.port,
        secure: connection.secure,
        target: targetDescriptor,
      });

      await Promise.all([
        safeDomainCall(rawClient.Page, 'enable'),
        safeDomainCall(rawClient.Runtime, 'enable'),
        safeDomainCall(rawClient.Log, 'enable'),
        safeDomainCall(rawClient.Network, 'enable'),
      ]);

      return createBufferedClientLegacy(rawClient, mappedTarget, endpoint);
    },

    async connectToPageTarget(endpoint, targetHint = {}) {
      const targets = await this.listPageTargets(endpoint, targetHint);
      const target = selectPageTarget(targets, targetHint);

      if (!target) {
        throw new Error('No page target matched the provided targetHint.');
      }

      const client = await this.attachToTarget(endpoint, target);
      return {
        target,
        client,
      };
    },
  };
}

module.exports = {
  createCdpClientAdapter,
  normalizeCdpEndpoint,
  selectPageTarget,
};
