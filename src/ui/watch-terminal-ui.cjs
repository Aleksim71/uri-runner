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

function inferStateFromStatus(value) {
  const text = String(value || '').toLowerCase();

  if (
    text === 'accepted' ||
    text === 'execution completed' ||
    text === 'completed'
  ) {
    return 'success';
  }

  if (
    text === 'execution failed' ||
    text === 'config_error' ||
    text.includes('fatal') ||
    text.includes('error')
  ) {
    return 'error';
  }

  if (
    text === 'started' ||
    text === 'inbox.zip detected' ||
    text === 'waiting for inbox.zip' ||
    text === 'stopping' ||
    text === 'execution started' ||
    text === 'no inbox.zip found'
  ) {
    return 'warn';
  }

  return 'info';
}

function createWatchTerminalUi(options = {}) {
  const renderer = createTerminalRenderer({
    cliTheme: options.theme || resolveThemeFromEnv(options.env),
    noColor:
      options.noColor === true ||
      resolveNoColorFromEnv(options.env)
  });

  const state = {
    headerPrinted: false,
    pipelineShown: false,
    artifactsShown: false,
    summaryShown: false
  };

  function printBanner(meta = []) {
    console.log(renderer.header('URI WATCH', meta));
    state.headerPrinted = true;
  }

  function ensurePipelineSection() {
    if (state.pipelineShown) return;
    console.log(renderer.section('PIPELINE'));
    state.pipelineShown = true;
  }

  function ensureArtifactsSection() {
    if (state.artifactsShown) return;
    console.log(renderer.section('ARTIFACTS'));
    state.artifactsShown = true;
  }

  function ensureSummarySection() {
    if (state.summaryShown) return;
    console.log(renderer.section('SUMMARY'));
    state.summaryShown = true;
  }

  function printSection(title) {
    console.log(renderer.section(title));
  }

  function printStatus(label, text, statusState = 'info') {
    ensurePipelineSection();
    console.log(renderer.step(label, text, statusState));
  }

  function printArtifact(label, value) {
    ensureArtifactsSection();
    console.log(renderer.path(label, value));
  }

  function printLegacyStatus(value) {
    printStatus('status', value, inferStateFromStatus(value));
  }

  function printSummary(result = {}) {
    ensureSummarySection();

    if (result.result) {
      console.log(
        renderer.step(
          'result',
          String(result.result),
          result.result === 'success' ? 'success' : 'error'
        )
      );
    }

    if (typeof result.steps === 'number' && typeof result.totalSteps === 'number') {
      console.log(
        renderer.step(
          'steps',
          `${result.steps}/${result.totalSteps} passed`,
          result.steps === result.totalSteps ? 'success' : 'warn'
        )
      );
    }

    if (typeof result.checks === 'number' && typeof result.totalChecks === 'number') {
      console.log(
        renderer.step(
          'checks',
          `${result.checks}/${result.totalChecks} passed`,
          result.checks === result.totalChecks ? 'success' : 'warn'
        )
      );
    }
  }

  function resetSections() {
    state.pipelineShown = false;
    state.artifactsShown = false;
    state.summaryShown = false;
  }

  return {
    renderer,
    state,
    printBanner,
    printSection,
    printStatus,
    printArtifact,
    printLegacyStatus,
    printSummary,
    resetSections
  };
}

module.exports = {
  createWatchTerminalUi,
  resolveThemeFromEnv,
  resolveNoColorFromEnv,
  inferStateFromStatus
};
