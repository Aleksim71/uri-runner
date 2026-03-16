'use strict';

const {
  createDeterministicStepId
} = require('./create-deterministic-step-id.cjs');

/**
 * URI Runner
 * Execution Events Collector
 *
 * A4 + A5 implementation:
 * - live terminal reporting
 * - step lifecycle management
 * - event bus emission for trace / other subscribers
 * - deterministic stepId generation
 *
 * Events emitted:
 * - step_started
 * - step_finished
 */

function createExecutionEvents(options = {}) {

  const writer = normalizeWriter(options.writer);
  const eventBus = options.eventBus || null;

  const steps = [];

  let nextScenarioIndex = 1;
  let nextVerificationIndex = 1;

  function startStep(input) {

    validateStartInput(input);

    const phase = input.phase;

    const index =
      phase === 'scenario'
        ? nextScenarioIndex++
        : nextVerificationIndex++;

    const id = createDeterministicStepId({
      phase,
      index,
      command: input.command,
      message: input.message
    });

    const step = {
      id,
      index,
      phase,
      command: input.command,
      message: input.message,
      status: 'running',
      result: null,
      details: null
    };

    steps.push(step);

    writer.writeStepStarted(step);

    if (eventBus) {
      eventBus.emit({
        type: 'step_started',
        stepId: step.id,
        phase: step.phase,
        command: step.command,
        message: step.message,
        index: step.index
      });
    }

    return id;
  }

  function finishStep(stepId, input) {

    validateFinishInput(input);

    const step = findStepById(stepId);

    if (!step) {
      throw new Error(
        `execution-events: unknown step id "${stepId}"`
      );
    }

    if (step.status !== 'running') {
      throw new Error(
        `execution-events: step "${stepId}" already finished`
      );
    }

    step.status = input.result;
    step.result = input.result;
    step.details = normalizeDetails(input.details);

    writer.writeStepFinished(step);

    if (eventBus) {
      eventBus.emit({
        type: 'step_finished',
        stepId: step.id,
        phase: step.phase,
        command: step.command,
        result: step.result,
        details: step.details,
        index: step.index
      });
    }

    return cloneStep(step);
  }

  function getScenarioSteps() {

    return steps
      .filter((s) => s.phase === 'scenario')
      .map(toReportStep);

  }

  function getVerificationSteps() {

    return steps
      .filter((s) => s.phase === 'verification')
      .map(toReportStep);

  }

  function getAllSteps() {

    return steps.map(cloneStep);

  }

  function buildTerminalReportData(input) {

    validateReportInput(input);

    return {
      goal: input.goal,

      scenario: {
        steps: getScenarioSteps()
      },

      verification: {
        steps: getVerificationSteps()
      },

      finalStatus: input.finalStatus,

      attempts: input.attempts
    };
  }

  function reset() {

    steps.length = 0;

    nextScenarioIndex = 1;
    nextVerificationIndex = 1;

  }

  return {
    startStep,
    finishStep,
    getScenarioSteps,
    getVerificationSteps,
    getAllSteps,
    buildTerminalReportData,
    reset
  };

  function findStepById(stepId) {

    return steps.find((s) => s.id === stepId) || null;

  }
}

function createConsoleWriter(output = console.log) {

  return {

    writeStepStarted(step) {

      output(`${step.index}. ${step.message}...`);

    },

    writeStepFinished(step) {

      output(`   Result: ${String(step.result).toUpperCase()}`);

      if (step.details) {
        output(`   Details: ${step.details}`);
      }

    }

  };

}

function normalizeWriter(writer) {

  if (!writer) {
    return createConsoleWriter();
  }

  if (
    typeof writer.writeStepStarted !== 'function' ||
    typeof writer.writeStepFinished !== 'function'
  ) {
    throw new Error(
      'execution-events: writer must implement writeStepStarted and writeStepFinished'
    );
  }

  return writer;
}

function toReportStep(step) {

  return {
    phase: step.phase,
    command: step.command,
    message: step.message,
    result: step.result,
    details: step.details
  };

}

function cloneStep(step) {

  return {
    id: step.id,
    index: step.index,
    phase: step.phase,
    command: step.command,
    message: step.message,
    status: step.status,
    result: step.result,
    details: step.details
  };

}

function normalizeDetails(details) {

  if (details == null) {
    return null;
  }

  const value = String(details).trim();

  return value === '' ? null : value;

}

function validateStartInput(input) {

  if (!input || typeof input !== 'object') {
    throw new Error('execution-events: startStep input must be object');
  }

  if (input.phase !== 'scenario' && input.phase !== 'verification') {
    throw new Error(
      'execution-events: phase must be scenario or verification'
    );
  }

  if (typeof input.command !== 'string' || input.command.trim() === '') {
    throw new Error(
      'execution-events: command must be non-empty string'
    );
  }

  if (typeof input.message !== 'string' || input.message.trim() === '') {
    throw new Error(
      'execution-events: message must be non-empty string'
    );
  }

}

function validateFinishInput(input) {

  if (!input || typeof input !== 'object') {
    throw new Error('execution-events: finishStep input must be object');
  }

  if (
    input.result !== 'success' &&
    input.result !== 'error' &&
    input.result !== 'skipped'
  ) {
    throw new Error(
      'execution-events: result must be success | error | skipped'
    );
  }

}

function validateReportInput(input) {

  if (!input || typeof input !== 'object') {
    throw new Error(
      'execution-events: report input must be object'
    );
  }

  if (typeof input.goal !== 'string' || input.goal.trim() === '') {
    throw new Error(
      'execution-events: goal must be non-empty string'
    );
  }

  if (input.finalStatus !== 'success' && input.finalStatus !== 'error') {
    throw new Error(
      'execution-events: finalStatus must be success or error'
    );
  }

  if (!Number.isInteger(input.attempts) || input.attempts < 1) {
    throw new Error(
      'execution-events: attempts must be integer >= 1'
    );
  }

}

module.exports = {
  createExecutionEvents,
  createConsoleWriter
};
