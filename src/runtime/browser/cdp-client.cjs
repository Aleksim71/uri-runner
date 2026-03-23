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

async function safeRuntimeEvaluate(Runtime, expression) {
  const result = await safeDomainCall(Runtime, 'evaluate', {
    expression,
    returnByValue: true,
  });

  if (!result || !result.result) {
    return null;
  }

  return serializeRemoteObject(result.result);
}

function createBufferedClient(rawClient, target = {}) {
  const Runtime = rawClient.Runtime || null;
  const Page = rawClient.Page || null;
  const Log = rawClient.Log || null;
  const consoleMessages = [];
  const pageErrors = [];

  if (Runtime && typeof Runtime.consoleAPICalled === 'function') {
    Runtime.consoleAPICalled((event = {}) => {
      const args = Array.isArray(event.args) ? event.args.map(serializeRemoteObject) : [];
      consoleMessages.push({
        source: 'Runtime.consoleAPICalled',
        level: event.type || 'log',
        text: args.filter((value) => value !== null).join(' '),
        args,
        timestamp: event.timestamp || null,
      });
    });
  }

  if (Runtime && typeof Runtime.exceptionThrown === 'function') {
    Runtime.exceptionThrown((event = {}) => {
      const details = event.exceptionDetails || {};
      pageErrors.push({
        source: 'Runtime.exceptionThrown',
        level: 'error',
        text: details.text || details.exception?.description || 'Runtime exception thrown.',
        url: details.url || null,
        lineNumber: Number.isFinite(details.lineNumber) ? details.lineNumber : null,
        columnNumber: Number.isFinite(details.columnNumber) ? details.columnNumber : null,
        timestamp: event.timestamp || null,
      });
    });
  }

  if (Log && typeof Log.entryAdded === 'function') {
    Log.entryAdded((event = {}) => {
      const entry = event.entry || {};
      const normalized = {
        source: entry.source || 'Log.entryAdded',
        level: entry.level || 'info',
        text: entry.text || '',
        url: entry.url || null,
        timestamp: entry.timestamp || null,
      };

      consoleMessages.push(normalized);

      if (normalized.level === 'error') {
        pageErrors.push(normalized);
      }
    });
  }

  return {
    rawClient,
    async getPageMetadata() {
      const userAgent = await safeRuntimeEvaluate(Runtime, 'navigator.userAgent');
      const readyState = await safeRuntimeEvaluate(Runtime, 'document.readyState');
      const layoutMetrics = await safeDomainCall(Page, 'getLayoutMetrics');
      const frameTree = await safeDomainCall(Page, 'getFrameTree');

      return {
        url: target.url || null,
        title: target.title || null,
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
    async getConsoleMessages() {
      return consoleMessages.slice();
    },
    async getPageErrors() {
      return pageErrors.slice();
    },
    async close() {
      if (typeof rawClient.close === 'function') {
        await rawClient.close();
      }
    },
  };
}

function createCdpClientAdapter(options = {}) {
  const transport = options.transport || CDP;

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
      const connection = normalizeCdpEndpoint(endpoint);
      const targetDescriptor =
        typeof target.webSocketDebuggerUrl === 'string' && target.webSocketDebuggerUrl
          ? target.webSocketDebuggerUrl
          : target.id;

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
      ]);

      return createBufferedClient(rawClient, mapTarget(target));
    },
  };
}

module.exports = {
  createCdpClientAdapter,
  normalizeCdpEndpoint,
};
