'use strict';

/**
 * URI Runner
 * Terminal Report Renderer
 *
 * Renders final A4 terminal summary from normalized report DTO.
 *
 * Expected DTO shape:
 * {
 *   goal: string,
 *   scenario: { steps: Step[] },
 *   verification: { steps: Step[] },
 *   finalStatus: 'success' | 'error',
 *   attempts: number
 * }
 *
 * Step:
 * {
 *   phase: 'scenario' | 'verification',
 *   command: string,
 *   message: string,
 *   result: 'success' | 'error' | 'skipped',
 *   details: string | null
 * }
 */

function renderTerminalReport(report, options = {}) {
  validateReport(report);

  const write = normalizeWrite(options.write);

  write('');
  write('URI RUN REPORT');
  write('────────────────────────');

  write('');
  write('Goal');
  write(`  ${report.goal}`);

  renderStepSection(write, 'Scenario', report.scenario.steps);
  renderStepSection(write, 'Goal Verification', report.verification.steps);

  write('');
  write('Final Status');
  write(`  ${String(report.finalStatus).toUpperCase()}`);

  write('');
  write('Attempts');
  write(`  ${report.attempts}`);

  write('');
}

function renderStepSection(write, title, steps) {
  write('');
  write(title);

  if (!Array.isArray(steps) || steps.length === 0) {
    write('  none');
    return;
  }

  steps.forEach((step, index) => {
    validateStep(step, title, index);

    write(`  ${index + 1}. ${step.message}`);
    write(`     Result: ${String(step.result).toUpperCase()}`);

    if (step.details) {
      write(`     Details: ${step.details}`);
    }
  });
}

function normalizeWrite(write) {
  if (!write) {
    return console.log;
  }

  if (typeof write !== 'function') {
    throw new Error('terminal-report: options.write must be a function');
  }

  return write;
}

function validateReport(report) {
  if (!report || typeof report !== 'object') {
    throw new Error('terminal-report: report must be an object');
  }

  if (typeof report.goal !== 'string' || report.goal.trim() === '') {
    throw new Error('terminal-report: report.goal must be a non-empty string');
  }

  if (!report.scenario || typeof report.scenario !== 'object') {
    throw new Error('terminal-report: report.scenario must be an object');
  }

  if (!Array.isArray(report.scenario.steps)) {
    throw new Error('terminal-report: report.scenario.steps must be an array');
  }

  if (!report.verification || typeof report.verification !== 'object') {
    throw new Error('terminal-report: report.verification must be an object');
  }

  if (!Array.isArray(report.verification.steps)) {
    throw new Error('terminal-report: report.verification.steps must be an array');
  }

  if (report.finalStatus !== 'success' && report.finalStatus !== 'error') {
    throw new Error(
      'terminal-report: report.finalStatus must be "success" or "error"'
    );
  }

  if (!Number.isInteger(report.attempts) || report.attempts < 1) {
    throw new Error('terminal-report: report.attempts must be an integer >= 1');
  }
}

function validateStep(step, sectionTitle, index) {
  if (!step || typeof step !== 'object') {
    throw new Error(
      `terminal-report: ${sectionTitle} step at index ${index} must be an object`
    );
  }

  if (step.phase !== 'scenario' && step.phase !== 'verification') {
    throw new Error(
      `terminal-report: ${sectionTitle} step at index ${index} must have valid phase`
    );
  }

  if (typeof step.command !== 'string' || step.command.trim() === '') {
    throw new Error(
      `terminal-report: ${sectionTitle} step at index ${index} must have non-empty command`
    );
  }

  if (typeof step.message !== 'string' || step.message.trim() === '') {
    throw new Error(
      `terminal-report: ${sectionTitle} step at index ${index} must have non-empty message`
    );
  }

  if (
    step.result !== 'success' &&
    step.result !== 'error' &&
    step.result !== 'skipped'
  ) {
    throw new Error(
      `terminal-report: ${sectionTitle} step at index ${index} must have valid result`
    );
  }

  if (step.details != null && typeof step.details !== 'string') {
    throw new Error(
      `terminal-report: ${sectionTitle} step at index ${index} details must be string or null`
    );
  }
}

module.exports = {
  renderTerminalReport
};
