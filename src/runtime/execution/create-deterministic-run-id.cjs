'use strict';

const crypto = require('crypto');

/**
 * URI Runner
 * Deterministic Execution ID
 *
 * Builds stable runId from execution inputs.
 *
 * Priority:
 * 1. explicit context.runId
 * 2. deterministic hash from project + goal + plan
 */

function createDeterministicRunId(plan, context = {}) {
  if (typeof context.runId === 'string' && context.runId.trim() !== '') {
    return normalizeRunId(context.runId);
  }

  const project = normalizeString(context.project || 'default-project');
  const goal = normalizeString(context.goal || 'execute-plan');
  const payload = normalizePlan(plan);

  const hash = crypto
    .createHash('sha1')
    .update(JSON.stringify({
      project,
      goal,
      plan: payload
    }))
    .digest('hex')
    .slice(0, 12);

  return `run_${hash}`;
}

function normalizeRunId(runId) {
  const value = String(runId).trim();

  if (value === '') {
    throw new Error('create-deterministic-run-id: runId must be non-empty');
  }

  return value
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '_');
}

function normalizePlan(plan) {
  if (!plan || typeof plan !== 'object') {
    return {
      execute: [],
      verify: []
    };
  }

  return {
    execute: normalizeSteps(plan.execute),
    verify: normalizeSteps(plan.verify)
  };
}

function normalizeSteps(steps) {
  if (!Array.isArray(steps)) {
    return [];
  }

  return steps.map((step) => ({
    command: normalizeString(step && step.command),
    message: normalizeString(step && step.message),
    args: normalizeArgs(step && step.args)
  }));
}

function normalizeArgs(args) {
  if (args == null) {
    return null;
  }

  if (Array.isArray(args)) {
    return args.map((item) => normalizePrimitive(item));
  }

  if (typeof args === 'object') {
    return sortObject(args);
  }

  return normalizePrimitive(args);
}

function sortObject(input) {
  const output = {};

  for (const key of Object.keys(input).sort()) {
    const value = input[key];

    if (Array.isArray(value)) {
      output[key] = value.map((item) => normalizePrimitive(item));
      continue;
    }

    if (value && typeof value === 'object') {
      output[key] = sortObject(value);
      continue;
    }

    output[key] = normalizePrimitive(value);
  }

  return output;
}

function normalizePrimitive(value) {
  if (value == null) {
    return null;
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  if (
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  return String(value);
}

function normalizeString(value) {
  if (value == null) {
    return '';
  }

  return String(value).trim();
}

module.exports = {
  createDeterministicRunId
};
