'use strict';

const path = require('path');
const fs = require('fs/promises');

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
  buildRuntimePaths,
  ensureRuntimeDirectories
} = require('./runtime-paths.cjs');

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
 * - default traceDir resolves from runtimePaths.runTracesDir
 * - explicit context.traceDir still overrides default behavior
 */

async function runWithTrace(plan, context = {}) {
  const runId = createDeterministicRunId(plan, context);
  const runtimePaths = resolveRuntimePaths({
    context,
    runId
  });

  const traceDir = resolveTraceDir({
    inputTraceDir: context.traceDir,
    runtimePaths
  });

  if (runtimePaths) {
    ensureRuntimeDirectories(runtimePaths);
  } else {
    await ensureDir(traceDir);
  }

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
    runtimePaths,
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
    runtimePaths,
    trace: finalizeResult
  };
}

function resolveRuntimePaths({ context, runId }) {
  if (!context || typeof context !== 'object') {
    return null;
  }

  const projectRoot = resolveProjectRoot(context.projectRoot);
  if (!projectRoot) {
    return null;
  }

  return buildRuntimePaths({
    projectRoot,
    runId,
    workspaceDir: context.workspaceDir || null
  });
}

function resolveTraceDir({ inputTraceDir, runtimePaths }) {
  if (typeof inputTraceDir === 'string' && inputTraceDir.trim() !== '') {
    return path.resolve(inputTraceDir);
  }

  if (runtimePaths && runtimePaths.runTracesDir) {
    return runtimePaths.runTracesDir;
  }

  return path.resolve(__dirname, '../../runtime/traces');
}

function resolveProjectRoot(projectRoot) {
  if (typeof projectRoot === 'string' && projectRoot.trim() !== '') {
    return path.resolve(projectRoot);
  }

  return null;
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

module.exports = {
  runWithTrace
};
