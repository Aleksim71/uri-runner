'use strict';

/**
 * URI Runner
 * ExecutionError
 *
 * Canonical runtime error used by execution engine.
 */

class ExecutionError extends Error {

  constructor(options = {}) {

    const message =
      typeof options.message === 'string'
        ? options.message
        : 'Execution error';

    super(message);

    this.name = 'ExecutionError';

    this.type = normalizeType(options.type);

    this.phase = options.phase || null;

    this.stepId = options.stepId || null;

    this.command = options.command || null;

    this.details = options.details || null;

  }

}

function normalizeType(type) {

  if (!type) return 'runtime_error';

  return String(type);

}

function isExecutionError(error) {

  return error instanceof ExecutionError;

}

function normalizeError(error, context = {}) {

  if (isExecutionError(error)) {
    return error;
  }

  return new ExecutionError({
    type: 'runtime_error',
    message: error && error.message ? error.message : 'Unknown error',
    phase: context.phase || null,
    stepId: context.stepId || null,
    command: context.command || null
  });

}

module.exports = {
  ExecutionError,
  isExecutionError,
  normalizeError
};
