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
  runPlan
} = require('./run-plan.cjs');

/**
 * URI Runner
 * Runtime bootstrap with execution trace support
 *
 * Responsibilities:
 * - create event bus
 * - attach trace subscriber
 * - create execution events collector
 * - run execution plan
 * - finalize normalized trace.json
 */

async function runWithTrace(plan, context = {}) {
  const runId = normalizeRunId(context.runId || createRunId());
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
    return inputTraceDir;
  }

  return path.join(process.cwd(), 'runtime', 'traces');
}

function normalizeRunId(runId) {
  if (typeof runId !== 'string' || runId.trim() === '') {
    throw new Error('run-with-trace: runId must be a non-empty string');
  }

  return runId.trim();
}

function createRunId() {
  const now = new Date();

  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const hh = String(now.getUTCHours()).padStart(2, '0');
  const mi = String(now.getUTCMinutes()).padStart(2, '0');
  const ss = String(now.getUTCSeconds()).padStart(2, '0');

  return `run_${yyyy}${mm}${dd}_${hh}${mi}${ss}`;
}

module.exports = {
  runWithTrace
};
