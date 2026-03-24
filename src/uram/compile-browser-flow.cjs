// path: src/uram/compile-browser-flow.cjs

'use strict';

const ACTION_TO_STEP_NAME = {
  'session.start': 'browser.session.start',
  'page.open': 'browser.page.open',
  'page.wait': 'browser.page.wait',
  'diagnostics.collect': 'browser.diagnostics.collect',
  'session.stop': 'browser.session.stop'
};

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertFlowIsArray(flow) {
  if (!Array.isArray(flow)) {
    throw new Error('Browser flow must be an array.');
  }
}

function createInput(action, item, index) {
  if (action === 'page.open') {
    if (typeof item.url !== 'string' || item.url.trim() === '') {
      throw new Error(
        `Browser flow item at index ${index} with action page.open must include url.`
      );
    }

    return {
      url: item.url
    };
  }

  if (action === 'page.wait') {
    const input = {};

    if (Object.prototype.hasOwnProperty.call(item, 'waitUntil')) {
      if (typeof item.waitUntil !== 'string' || item.waitUntil.trim() === '') {
        throw new Error(
          `Browser flow item at index ${index} with action page.wait must use a non-empty string waitUntil when provided.`
        );
      }

      input.waitUntil = item.waitUntil;
    }

    if (Object.prototype.hasOwnProperty.call(item, 'timeoutMs')) {
      if (!Number.isInteger(item.timeoutMs) || item.timeoutMs < 0) {
        throw new Error(
          `Browser flow item at index ${index} with action page.wait must use a non-negative integer timeoutMs when provided.`
        );
      }

      input.timeoutMs = item.timeoutMs;
    }

    return input;
  }

  return {};
}

function compileBrowserFlowItem(item, index) {
  if (!isPlainObject(item)) {
    throw new Error(`Browser flow item at index ${index} must be an object.`);
  }

  if (typeof item.action !== 'string' || item.action.trim() === '') {
    throw new Error(`Browser flow item at index ${index} must include action.`);
  }

  const action = item.action.trim();
  const stepName = ACTION_TO_STEP_NAME[action];

  if (!stepName) {
    throw new Error(`Browser flow item at index ${index} has unknown action: ${action}`);
  }

  return {
    name: stepName,
    input: createInput(action, item, index)
  };
}

function compileBrowserFlow(browserConfig) {
  if (!browserConfig) {
    return [];
  }

  if (!Object.prototype.hasOwnProperty.call(browserConfig, 'flow')) {
    return [];
  }

  const { flow } = browserConfig;

  if (flow === undefined || flow === null) {
    return [];
  }

  assertFlowIsArray(flow);

  return flow.map((item, index) => compileBrowserFlowItem(item, index));
}

module.exports = {
  compileBrowserFlow
};
