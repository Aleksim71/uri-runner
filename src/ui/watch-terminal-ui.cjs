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


function pickSummaryPayload(result = {}) {
  if (result && result.summary && typeof result.summary === 'object') {
    return result.summary;
  }

  return {};
}

function numberOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function formatDurationMs(value) {
  const ms = numberOrNull(value);
  if (ms === null) return '-';
  if (ms < 1000) return `${ms} ms`;

  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes <= 0) return `${totalSeconds} s`;
  return `${minutes}m ${seconds}s`;
}

function formatRatio(done, total) {
  if (!Number.isInteger(total)) return null;
  const left = Number.isInteger(done) ? done : 0;
  return `${left}/${total}`;
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

    const summary = pickSummaryPayload(result);
    const finalResult =
      summary.result ||
      result.result ||
      result.status ||
      '-';

    console.log(
      renderer.step(
        'result',
        String(finalResult),
        finalResult === 'success' ? 'success' : finalResult === 'error' ? 'error' : 'warn'
      )
    );

    const stepsRatio =
      formatRatio(summary.stepsCompleted, summary.stepsTotal) ||
      (typeof result.steps === 'number' && typeof result.totalSteps === 'number'
        ? `${result.steps}/${result.totalSteps}`
        : null);

    if (stepsRatio) {
      const total = Number.isInteger(summary.stepsTotal) ? summary.stepsTotal : result.totalSteps;
      const done = Number.isInteger(summary.stepsCompleted) ? summary.stepsCompleted : result.steps;

      console.log(
        renderer.step(
          'steps',
          `${stepsRatio} passed`,
          typeof total === 'number' && typeof done === 'number' && done === total ? 'success' : 'warn'
        )
      );
    }

    const checksRatio =
      formatRatio(summary.checksPassed, summary.checksTotal) ||
      (typeof result.checks === 'number' && typeof result.totalChecks === 'number'
        ? `${result.checks}/${result.totalChecks}`
        : null);

    if (checksRatio) {
      const total = Number.isInteger(summary.checksTotal) ? summary.checksTotal : result.totalChecks;
      const done = Number.isInteger(summary.checksPassed) ? summary.checksPassed : result.checks;

      console.log(
        renderer.step(
          'checks',
          `${checksRatio} passed`,
          typeof total === 'number' && typeof done === 'number' && done === total ? 'success' : 'warn'
        )
      );
    }

    if (summary.project || result.project) {
      console.log(renderer.path('project', String(summary.project || result.project)));
    }

    if (summary.runId || result.runId) {
      console.log(renderer.path('runId', String(summary.runId || result.runId)));
    }

    if (summary.engine || summary.executionKind || result.engine) {
      console.log(
        renderer.path(
          'engine',
          String(summary.engine || summary.executionKind || result.engine)
        )
      );
    }

    if (numberOrNull(summary.durationMs) !== null) {
      console.log(renderer.path('duration', formatDurationMs(summary.durationMs)));
    }

    if (summary.projectOutboxZipPath) {
      console.log(renderer.path('outbox', String(summary.projectOutboxZipPath)));
    }

    if (summary.projectOutboxJsonPath) {
      console.log(renderer.path('outboxJson', String(summary.projectOutboxJsonPath)));
    }

    if (summary.latestOutboxZipPath) {
      console.log(renderer.path('transportOutbox', String(summary.latestOutboxZipPath)));
    }

    if (summary.historyOutboxZipPath) {
      console.log(renderer.path('historyOutbox', String(summary.historyOutboxZipPath)));
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
