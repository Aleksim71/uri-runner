'use strict';

/**
 * URI Runner
 * Trace Schema Contract
 *
 * Defines trace schema metadata.
 */

const TRACE_SCHEMA = 'uri.trace.v1';

function applyTraceSchema(trace) {

  if (!trace || typeof trace !== 'object') {
    throw new Error('trace-schema: trace must be object');
  }

  return {
    schema: TRACE_SCHEMA,
    runId: trace.runId || null,
    goal: trace.goal || null,
    finalStatus: trace.finalStatus || null,
    attempts: trace.attempts || 1,
    steps: Array.isArray(trace.steps) ? trace.steps : []
  };

}

module.exports = {
  TRACE_SCHEMA,
  applyTraceSchema
};
