// path: src/uram/compile-browser-flow.cjs
'use strict';

const ACTION_TO_COMMAND = {
  'session.start': 'browser.session.start',
  'page.open': 'browser.page.open',
  'page.wait': 'browser.page.wait',
  'diagnostics.collect': 'browser.diagnostics.collect',
  'session.stop': 'browser.session.stop'
};

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function assertNonEmptyString(value, message) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(message);
  }

  return value.trim();
}

function buildInput(item, index) {
  const input = {};

  for (const [key, value] of Object.entries(item)) {
    if (key === 'id' || key === 'action') {
      continue;
    }

    if (value === undefined) {
      continue;
    }

    input[key] = value;
  }

  return input;
}

function validateBrowserFlowItem(item, index) {
  if (!isObject(item)) {
    throw new Error(`Browser flow item at index ${index} must be an object.`);
  }

  const action = assertNonEmptyString(
    item.action,
    `Browser flow item at index ${index} must include action.`
  );

  if (!ACTION_TO_COMMAND[action]) {
    throw new Error(
      `Browser flow item at index ${index} has unsupported action: ${action}`
    );
  }

  if (action === 'page.open') {
    assertNonEmptyString(
      item.url,
      `Browser flow item at index ${index} with action page.open must include url.`
    );
  }

  return action;
}

function compileBrowserFlowItem(item, index) {
  const action = validateBrowserFlowItem(item, index);

  return {
    id: typeof item.id === 'string' && item.id.trim() ? item.id.trim() : null,
    name: ACTION_TO_COMMAND[action],
    input: buildInput(item, index),
  };
}

function compileBrowserFlow(browserConfig) {
  if (!browserConfig || typeof browserConfig !== 'object') {
    return [];
  }

  if (!Object.prototype.hasOwnProperty.call(browserConfig, 'flow')) {
    return [];
  }

  const { flow } = browserConfig;

  if (!Array.isArray(flow)) {
    throw new Error('browser.flow must be an array.');
  }

  return flow.map((item, index) => compileBrowserFlowItem(item, index));
}

module.exports = {
  compileBrowserFlow,
};
