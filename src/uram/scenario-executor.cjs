function createDefaultState(initialState) {
  if (initialState && typeof initialState === 'object' && !Array.isArray(initialState)) {
    if (!initialState.steps) {
      initialState.steps = {};
    }
    return initialState;
  }

  return { steps: {} };
}

async function executeScenario(parsedScenario, options = {}) {
  const { registry, maxSteps = 100 } = options;

  if (!registry) {
    throw new Error('executeScenario: registry is required');
  }

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
        stopReason: 'max_steps_exceeded',
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
        stopReason: 'unknown_step',
        currentStepId,
        visitedSteps,
        state,
      };
    }

    visitedSteps.push(step.id);

    let result;
    try {
      const handler = registry.resolve(step.command);
      result = await handler(step.args, {
        ...context,
        step,
      });
    } catch (error) {
      result = {
        ok: false,
        code: 'COMMAND_THROW',
        error: error instanceof Error ? error.message : String(error),
      };
    }

    state.steps[step.id] = result;

    if (step.stop) {
      return {
        ok: result.ok === true,
        finished: true,
        stopReason: 'stop_flag',
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
          stopReason: 'end_of_steps',
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
      stopReason: 'step_failed',
      currentStepId: step.id,
      visitedSteps,
      state,
    };
  }

  return {
    ok: true,
    finished: true,
    stopReason: 'no_current_step',
    currentStepId: null,
    visitedSteps,
    state,
  };
}

module.exports = { executeScenario };
