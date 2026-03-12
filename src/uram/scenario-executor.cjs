"use strict";

function createDefaultState(initialState) {
  if (initialState && typeof initialState === "object" && !Array.isArray(initialState)) {
    if (!initialState.steps) {
      initialState.steps = {};
    }
    return initialState;
  }

  return { steps: {} };
}

function preflightScenario(parsedScenario, options = {}) {
  const { registry, executableCtx } = options;

  if (!registry) {
    throw new Error("preflightScenario: registry is required");
  }

  const { steps, stepMap, startStepId } = parsedScenario || {};

  if (!Array.isArray(steps) || steps.length === 0) {
    throw new Error("preflightScenario: steps must be a non-empty array");
  }

  if (!stepMap || typeof stepMap !== "object") {
    throw new Error("preflightScenario: stepMap is required");
  }

  if (!startStepId || !stepMap[startStepId]) {
    throw new Error("preflightScenario: startStepId is missing or invalid");
  }

  for (const step of steps) {
    if (!step || typeof step !== "object") {
      throw new Error("preflightScenario: step must be an object");
    }

    if (!step.id || typeof step.id !== "string") {
      throw new Error("preflightScenario: step id must be a non-empty string");
    }

    if (!step.command || typeof step.command !== "string") {
      throw new Error(`preflightScenario: step "${step.id}" must have a command`);
    }

    registry.assertAllowed(step.command, executableCtx);
  }

  return true;
}

async function executeStep(step, options = {}) {
  const { registry, context = {}, executableCtx = null } = options;

  const handler = registry.resolve(step.command, executableCtx);

  try {
    const result = await handler(step.args, {
      ...context,
      step,
    });

    return result;
  } catch (error) {
    return {
      ok: false,
      code: "COMMAND_THROW",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function executeScenario(parsedScenario, options = {}) {
  const { registry, maxSteps = 100, executableCtx = null } = options;

  if (!registry) {
    throw new Error("executeScenario: registry is required");
  }

  preflightScenario(parsedScenario, { registry, executableCtx });

  const logger = options.context?.logger ?? console;
  const cwd = options.context?.cwd ?? process.cwd();
  const state = createDefaultState(options.context?.state);

  const context = {
    logger,
    cwd,
    state,
  };

  const { steps, stepMap, startStepId } = parsedScenario;
  const stepIndexMap = new Map(steps.map((step, index) => [step.id, index]));

  let currentStepId = startStepId;
  let executedCount = 0;
  const visitedSteps = [];

  while (currentStepId) {
    executedCount += 1;

    if (executedCount > maxSteps) {
      return {
        ok: false,
        finished: false,
        stopReason: "max_steps_exceeded",
        currentStepId,
        visitedSteps,
        state,
      };
    }

    const step = stepMap[currentStepId];

    if (!step) {
      return {
        ok: false,
        finished: false,
        stopReason: "unknown_step",
        currentStepId,
        visitedSteps,
        state,
      };
    }

    visitedSteps.push(step.id);

    const result = await executeStep(step, {
      registry,
      context,
      executableCtx,
    });

    state.steps[step.id] = result;

    if (step.stop) {
      return {
        ok: result.ok === true,
        finished: true,
        stopReason: "stop_flag",
        currentStepId: step.id,
        visitedSteps,
        state,
      };
    }

    if (result.ok === true) {
      if (step.onSuccess) {
        currentStepId = step.onSuccess;
        continue;
      }

      const nextIndex = stepIndexMap.get(step.id) + 1;
      currentStepId = steps[nextIndex]?.id ?? null;

      if (!currentStepId) {
        return {
          ok: true,
          finished: true,
          stopReason: "end_of_steps",
          currentStepId: step.id,
          visitedSteps,
          state,
        };
      }

      continue;
    }

    if (step.onFailure) {
      currentStepId = step.onFailure;
      continue;
    }

    return {
      ok: false,
      finished: true,
      stopReason: "step_failed",
      currentStepId: step.id,
      visitedSteps,
      state,
    };
  }

  return {
    ok: true,
    finished: true,
    stopReason: "no_current_step",
    currentStepId: null,
    visitedSteps,
    state,
  };
}

module.exports = {
  preflightScenario,
  executeScenario,
};
