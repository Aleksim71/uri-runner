'use strict';

const path = require('path');

const {
  createExecutionEventBus
} = require('./execution/execution-event-bus.cjs');

const {
  createTraceEventSubscriber
} = require('./execution/trace-event-subscriber.cjs');

const {
  createExecutionEvents
} = require('./execution/execution-events.cjs');

const {
  finalizeTrace
} = require('./execution/trace-finalizer.cjs');

const {
  createDeterministicRunId
} = require('./execution/create-deterministic-run-id.cjs');

const {
  runPlan
} = require('./run-plan.cjs');

/**
 * URI Runner
 * Runtime bootstrap with execution trace support
 *
 * Responsibilities:
 * - create deterministic runId
 * - create event bus
 * - attach trace subscriber
 * - create execution events collector
 * - run execution plan
 * - finalize normalized trace.json
 *
 * Important:
 * - traceDir resolves from project root, not from process.cwd()
 */

async function runWithTrace(plan, context = {}) {
  const runId = createDeterministicRunId(plan, context);
  const traceDir = resolveTraceDir(context.traceDir);

  const eventBus = createExecutionEventBus();

  const traceSubscriber = createTraceEventSubscriber({
    traceDir,
    runId
  });

  const unsubscribeTrace = eventBus.subscribe(traceSubscriber.handleEvent);

  const executionEvents = createExecutionEvents({
    eventBus,
    writer: context.writer
  });

  const runtimeContext = {
    ...context,
    runId,
    traceDir,
    executionEvents
  };

  let result;
  let finalizeResult = null;

  try {
    eventBus.emit({
      type: 'run_started',
      runId,
      project: runtimeContext.project || null,
      goal: runtimeContext.goal || 'Execute plan'
    });

    result = await runPlan(plan, runtimeContext);

    eventBus.emit({
      type: 'run_finished',
      runId,
      finalStatus: result.status,
      attempts: result.attempts
    });
  } catch (error) {
    eventBus.emit({
      type: 'run_finished',
      runId,
      finalStatus: 'error',
      attempts: 1,
      errorMessage: error.message
    });

    throw error;
  } finally {
    unsubscribeTrace();

    await traceSubscriber.close();

    finalizeResult = await finalizeTrace({
      traceDir,
      runId
    });
  }

  return {
    ...result,
    runId,
    traceDir,
    trace: finalizeResult
  };
}

function resolveTraceDir(inputTraceDir) {
  if (typeof inputTraceDir === 'string' && inputTraceDir.trim() !== '') {
    return path.resolve(inputTraceDir);
  }

  return path.resolve(__dirname, '../../runtime/traces');
}

module.exports = {
  runWithTrace
};
