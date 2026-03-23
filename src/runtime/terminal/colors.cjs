// path: src/runtime/terminal/colors.cjs

'use strict';

const picocolors = require('picocolors');

function createTerminalPalette(options = {}) {
  if (typeof picocolors.createColors === 'function') {
    if (typeof options.enabled === 'boolean') {
      return picocolors.createColors(options.enabled);
    }
  }

  return picocolors;
}

const STATE_COLOR_NAMES = {
  queued: 'cyan',
  running: 'blue',
  done: 'green',
  success: 'green',
  warn: 'yellow',
  warning: 'yellow',
  failed: 'red',
  error: 'red',
  skipped: 'gray',
  info: 'magenta',
};

function getColorFunction(state, palette) {
  const colorName = STATE_COLOR_NAMES[state] || STATE_COLOR_NAMES.info;
  const colorFn = palette[colorName];
  return typeof colorFn === 'function' ? colorFn : (value) => String(value);
}

function colorizeQueueState(state, text = state, options = {}) {
  const palette = options.palette || createTerminalPalette(options);
  const normalizedState = typeof state === 'string' ? state.trim().toLowerCase() : 'info';
  return getColorFunction(normalizedState, palette)(String(text));
}

function formatQueueMessage(entry = {}, options = {}) {
  const palette = options.palette || createTerminalPalette(options);
  const state = typeof entry.state === 'string' && entry.state ? entry.state : 'info';
  const label = typeof entry.label === 'string' ? entry.label : '';
  const detail = typeof entry.detail === 'string' ? entry.detail : '';
  const badge = colorizeQueueState(state, `[${state.toUpperCase()}]`, { palette });
  const suffix = detail ? ` ${palette.dim(detail)}` : '';
  return `${badge}${label ? ` ${label}` : ''}${suffix}`.trim();
}

module.exports = {
  STATE_COLOR_NAMES,
  colorizeQueueState,
  createTerminalPalette,
  formatQueueMessage,
};
