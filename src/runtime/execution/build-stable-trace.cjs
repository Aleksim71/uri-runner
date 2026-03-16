'use strict';

/**
 * URI Runner
 * Stable Trace Builder
 *
 * Converts raw events → deterministic trace structure.
 */

function buildStableTrace(events, runId) {

  const steps = new Map();

  let goal = null;
  let finalStatus = null;
  let attempts = 1;
  let createdAt = null;

  for (const event of events) {

    if (event.type === 'run_started') {
      goal = normalizeString(event.goal);
      createdAt = pickTimestamp(event);
    }

    if (event.type === 'step_started') {

      steps.set(event.stepId, {
        id: event.stepId,
        phase: event.phase,
        index: event.index,
        command: normalizeString(event.command),
        message: normalizeString(event.message),
        result: null,
        details: null
      });

    }

    if (event.type === 'step_finished') {

      const step = steps.get(event.stepId);

      if (!step) continue;

      step.result = normalizeString(event.result);
      step.details = normalizeString(event.details);

    }

    if (event.type === 'run_finished') {
      finalStatus = normalizeString(event.finalStatus);
      attempts = normalizeAttempts(event.attempts);
    }

  }

  const orderedSteps = Array
    .from(steps.values())
    .sort(compareSteps);

  return {
    runId: normalizeString(runId),
    createdAt,
    goal,
    finalStatus,
    attempts,
    steps: orderedSteps.map(toStableStep)
  };

}

function compareSteps(a, b) {

  if (a.phase !== b.phase) {

    if (a.phase === 'scenario') return -1;
    if (b.phase === 'scenario') return 1;

  }

  return a.index - b.index;

}

function toStableStep(step) {

  return {
    id: step.id,
    phase: step.phase,
    index: step.index,
    command: step.command,
    message: step.message,
    result: step.result,
    details: step.details
  };

}

function pickTimestamp(event) {
  const candidates = [
    event.createdAt,
    event.timestamp,
    event.ts,
    event.time
  ];

  for (const candidate of candidates) {
    const normalized = normalizeString(candidate);

    if (normalized) {
      return normalized;
    }
  }

  return new Date().toISOString();
}

function normalizeString(value) {

  if (value == null) return null;

  const v = String(value).trim();

  return v === '' ? null : v;

}

function normalizeAttempts(value) {

  if (!Number.isInteger(value) || value < 1) {
    return 1;
  }

  return value;

}

module.exports = {
  buildStableTrace
};
