'use strict';

/**
 * URI Runner
 * run-plan
 *
 * Executes compiled PLAN using executionEvents interface.
 *
 * executionEvents responsibilities:
 * - terminal reporting
 * - event bus emission
 * - step lifecycle management
 */

async function runPlan(plan, context = {}) {

  if (!plan || typeof plan !== 'object') {
    throw new Error('run-plan: plan must be an object');
  }

  const events = context.executionEvents;

  if (!events) {
    throw new Error('run-plan: executionEvents is required in context');
  }

  const goal = typeof context.goal === 'string'
    ? context.goal
    : 'Execute plan';

  let attempts = 1;

  try {

    // ----------------------------
    // SCENARIO
    // ----------------------------

    if (Array.isArray(plan.execute)) {

      for (const step of plan.execute) {

        const stepId = events.startStep({
          phase: 'scenario',
          command: step.command,
          message: step.message || step.command
        });

        try {

          await executeCommand(step, context);

          events.finishStep(stepId, {
            result: 'success',
            details: 'Command completed'
          });

        } catch (error) {

          events.finishStep(stepId, {
            result: 'error',
            details: error.message
          });

          throw error;

        }

      }

    }

    // ----------------------------
    // VERIFICATION
    // ----------------------------

    if (Array.isArray(plan.verify)) {

      for (const step of plan.verify) {

        const stepId = events.startStep({
          phase: 'verification',
          command: step.command,
          message: step.message || step.command
        });

        try {

          await verifyCommand(step, context);

          events.finishStep(stepId, {
            result: 'success',
            details: 'Verification passed'
          });

        } catch (error) {

          events.finishStep(stepId, {
            result: 'error',
            details: error.message
          });

          throw error;

        }

      }

    }

    return {
      status: 'success',
      attempts
    };

  } catch (error) {

    return {
      status: 'error',
      attempts,
      error: error.message
    };

  }

}

/**
 * Executes scenario command
 */
async function executeCommand(step, context) {

  if (!step || typeof step !== 'object') {
    throw new Error('executeCommand: invalid step');
  }

  if (typeof step.command !== 'string') {
    throw new Error('executeCommand: command must be string');
  }

  if (typeof context.commandExecutor !== 'function') {
    throw new Error('executeCommand: context.commandExecutor required');
  }

  return context.commandExecutor(step, context);

}

/**
 * Executes verification command
 */
async function verifyCommand(step, context) {

  if (!step || typeof step !== 'object') {
    throw new Error('verifyCommand: invalid step');
  }

  if (typeof step.command !== 'string') {
    throw new Error('verifyCommand: command must be string');
  }

  if (typeof context.verificationExecutor !== 'function') {
    throw new Error('verifyCommand: context.verificationExecutor required');
  }

  return context.verificationExecutor(step, context);

}

module.exports = {
  runPlan
};
