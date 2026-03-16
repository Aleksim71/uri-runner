'use strict';

const fs = require('fs');
const path = require('path');

const SUPPORTED_TRACE_SCHEMA = 'uri.trace.v1';

/**
 * URI Runner
 * Execution Replay
 *
 * Replays normalized trace.json in human-readable terminal form.
 *
 * This is trace replay, not command re-execution.
 */

async function replayTrace(input, options = {}) {
  const trace = await loadTrace(input);

  validateTrace(trace);

  const write = normalizeWrite(options.write);
  const includeDetails = options.includeDetails !== false;

  write('');
  write('URI TRACE REPLAY');
  write('────────────────────────');
  write('');

  write('Schema');
  write(`  ${trace.schema}`);

  write('');
  write('Run');
  write(`  ${trace.runId}`);

  write('');
  write('Goal');
  write(`  ${trace.goal || 'none'}`);

  renderPhase(write, 'Scenario Replay', getStepsByPhase(trace.steps, 'scenario'), includeDetails);
  renderPhase(
    write,
    'Verification Replay',
    getStepsByPhase(trace.steps, 'verification'),
    includeDetails
  );

  write('');
  write('Final Status');
  write(`  ${String(trace.finalStatus || 'unknown').toUpperCase()}`);

  write('');
  write('Attempts');
  write(`  ${normalizeAttempts(trace.attempts)}`);

  write('');

  return {
    runId: trace.runId,
    schema: trace.schema,
    finalStatus: trace.finalStatus,
    attempts: normalizeAttempts(trace.attempts),
    stepCount: Array.isArray(trace.steps) ? trace.steps.length : 0
  };
}

async function loadTrace(input) {
  const filePath = normalizeTracePath(input);

  const raw = await fs.promises.readFile(filePath, 'utf8');

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`replay-trace: invalid JSON in trace file: ${filePath}`);
  }
}

function normalizeTracePath(input) {
  if (typeof input === 'string' && input.trim() !== '') {
    return path.resolve(input.trim());
  }

  if (input && typeof input === 'object' && typeof input.tracePath === 'string') {
    return path.resolve(input.tracePath.trim());
  }

  throw new Error('replay-trace: trace path is required');
}

function validateTrace(trace) {
  if (!trace || typeof trace !== 'object' || Array.isArray(trace)) {
    throw new Error('replay-trace: trace must be an object');
  }

  if (trace.schema !== SUPPORTED_TRACE_SCHEMA) {
    throw new Error(
      `replay-trace: unsupported trace schema "${trace.schema}", expected "${SUPPORTED_TRACE_SCHEMA}"`
    );
  }

  if (typeof trace.runId !== 'string' || trace.runId.trim() === '') {
    throw new Error('replay-trace: trace.runId must be a non-empty string');
  }

  if (!Array.isArray(trace.steps)) {
    throw new Error('replay-trace: trace.steps must be an array');
  }

  trace.steps.forEach(validateStep);
}

function validateStep(step, index) {
  if (!step || typeof step !== 'object' || Array.isArray(step)) {
    throw new Error(`replay-trace: step at index ${index} must be an object`);
  }

  if (typeof step.id !== 'string' || step.id.trim() === '') {
    throw new Error(`replay-trace: step at index ${index} must have non-empty id`);
  }

  if (step.phase !== 'scenario' && step.phase !== 'verification') {
    throw new Error(`replay-trace: step at index ${index} has invalid phase`);
  }

  if (!Number.isInteger(step.index) || step.index < 1) {
    throw new Error(`replay-trace: step at index ${index} has invalid index`);
  }

  if (typeof step.command !== 'string' || step.command.trim() === '') {
    throw new Error(`replay-trace: step at index ${index} must have non-empty command`);
  }

  if (typeof step.message !== 'string' || step.message.trim() === '') {
    throw new Error(`replay-trace: step at index ${index} must have non-empty message`);
  }

  if (
    step.result !== 'success' &&
    step.result !== 'error' &&
    step.result !== 'skipped' &&
    step.result !== null
  ) {
    throw new Error(`replay-trace: step at index ${index} has invalid result`);
  }
}

function getStepsByPhase(steps, phase) {
  return steps
    .filter((step) => step.phase === phase)
    .slice()
    .sort(compareSteps);
}

function compareSteps(a, b) {
  return a.index - b.index;
}

function renderPhase(write, title, steps, includeDetails) {
  write('');
  write(title);

  if (!steps.length) {
    write('  none');
    return;
  }

  for (const step of steps) {
    write(`  ${step.index}. ${step.message}`);
    write(`     Step ID: ${step.id}`);
    write(`     Result: ${String(step.result || 'unknown').toUpperCase()}`);

    if (includeDetails && step.details) {
      write(`     Details: ${step.details}`);
    }
  }
}

function normalizeWrite(write) {
  if (!write) {
    return console.log;
  }

  if (typeof write !== 'function') {
    throw new Error('replay-trace: options.write must be a function');
  }

  return write;
}

function normalizeAttempts(value) {
  if (!Number.isInteger(value) || value < 1) {
    return 1;
  }

  return value;
}

module.exports = {
  replayTrace,
  SUPPORTED_TRACE_SCHEMA
};
