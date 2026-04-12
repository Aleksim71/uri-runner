// path: src/ui/watch-terminal-ui.cjs
'use strict';

const { createTerminalRenderer } = require('./terminal-render.cjs');

function resolveThemeFromEnv(env = process.env) {
  const value = String(
    env.URI_TERM_THEME ||
    env.URI_THEME ||
    env.TERMINAL_THEME ||
    'auto'
  ).trim().toLowerCase();

  if (value === 'dark' || value === 'light' || value === 'auto') {
    return value;
  }

  return 'auto';
}

function resolveNoColorFromEnv(env = process.env) {
  const value = String(
    env.URI_NO_COLOR ||
    env.NO_COLOR ||
    ''
  ).trim().toLowerCase();

  return value === '1' || value === 'true' || value === 'yes';
}

function createWatchTerminalUi(options = {}) {
  const renderer = createTerminalRenderer({
    cliTheme: options.theme || resolveThemeFromEnv(options.env),
    noColor: options.noColor === true || resolveNoColorFromEnv(options.env)
  });

  function printBanner(meta = []) {
    console.log(renderer.header('URI WATCH', meta));
  }

  function printSection(title) {
    console.log(renderer.section(title));
  }

  function printStatus(label, text, state = 'info') {
    console.log(renderer.step(label, text, state));
  }

  function printArtifact(label, value) {
    console.log(renderer.path(label, value));
  }

  function inferStateFromStatus(value) {
    const text = String(value || '').toLowerCase();

    if (
      text.includes('error') ||
      text.includes('failed') ||
      text.includes('fatal') ||
      text.includes('rejected')
    ) {
      return 'error';
    }

    if (
      text.includes('detected') ||
      text.includes('waiting') ||
      text.includes('accepted') ||
      text.includes('started')
    ) {
      return 'warn';
    }

    if (
      text.includes('completed') ||
      text.includes('written') ||
      text.includes('created') ||
      text.includes('success')
    ) {
      return 'success';
    }

    return 'info';
  }

  function printLegacyStatus(value) {
    printStatus('status', value, inferStateFromStatus(value));
  }

  return {
    renderer,
    printBanner,
    printSection,
    printStatus,
    printArtifact,
    printLegacyStatus
  };
}

module.exports = {
  createWatchTerminalUi,
  resolveThemeFromEnv,
  resolveNoColorFromEnv
};
