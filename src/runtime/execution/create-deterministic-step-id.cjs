'use strict';

const crypto = require('crypto');

/**
 * URI Runner
 * Deterministic Step ID
 *
 * Builds stable stepId from:
 * - phase
 * - per-phase index
 * - command
 * - message
 *
 * Result example:
 * scenario_1_a1b2c3d4
 */

function createDeterministicStepId(input = {}) {
  const phase = normalizePhase(input.phase);
  const index = normalizeIndex(input.index);
  const command = normalizeString(input.command);
  const message = normalizeString(input.message);

  const hash = crypto
    .createHash('sha1')
    .update(JSON.stringify({
      phase,
      index,
      command,
      message
    }))
    .digest('hex')
    .slice(0, 8);

  return `${phase}_${index}_${hash}`;
}

function normalizePhase(phase) {
  if (phase !== 'scenario' && phase !== 'verification') {
    throw new Error(
      'create-deterministic-step-id: phase must be scenario or verification'
    );
  }

  return phase;
}

function normalizeIndex(index) {
  if (!Number.isInteger(index) || index < 1) {
    throw new Error(
      'create-deterministic-step-id: index must be an integer >= 1'
    );
  }

  return index;
}

function normalizeString(value) {
  if (value == null) {
    return '';
  }

  return String(value).trim();
}

module.exports = {
  createDeterministicStepId
};
