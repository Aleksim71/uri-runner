function normalizeArgs(args) {
  if (args == null) return {};
  if (typeof args !== 'object' || Array.isArray(args)) {
    throw new Error('parseScenario: step.args must be an object when provided');
  }
  return args;
}

function parseScenario(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('parseScenario: input must be an object');
  }

  if (!Array.isArray(input.steps) || input.steps.length === 0) {
    throw new Error('parseScenario: steps must be a non-empty array');
  }

  const stepMap = Object.create(null);

  const steps = input.steps.map((step, index) => {
    if (!step || typeof step !== 'object' || Array.isArray(step)) {
      throw new Error(`parseScenario: step at index ${index} must be an object`);
    }

    if (!step.id || typeof step.id !== 'string') {
      throw new Error(`parseScenario: step at index ${index} must have a non-empty string id`);
    }

    if (!step.command || typeof step.command !== 'string') {
      throw new Error(`parseScenario: step "${step.id}" must have a non-empty string command`);
    }

    if (stepMap[step.id]) {
      throw new Error(`parseScenario: duplicate step id "${step.id}"`);
    }

    const normalized = {
      id: step.id,
      command: step.command,
      args: normalizeArgs(step.args),
      onSuccess: step.on_success ?? null,
      onFailure: step.on_failure ?? null,
      stop: step.stop === true,
    };

    stepMap[normalized.id] = normalized;
    return normalized;
  });

  const startStepId = input.scenario?.start ?? steps[0].id;

  if (!stepMap[startStepId]) {
    throw new Error(`parseScenario: scenario.start points to unknown step "${startStepId}"`);
  }

  for (const step of steps) {
    if (step.onSuccess && !stepMap[step.onSuccess]) {
      throw new Error(
        `parseScenario: step "${step.id}" has unknown on_success target "${step.onSuccess}"`
      );
    }

    if (step.onFailure && !stepMap[step.onFailure]) {
      throw new Error(
        `parseScenario: step "${step.id}" has unknown on_failure target "${step.onFailure}"`
      );
    }
  }

  return {
    startStepId,
    steps,
    stepMap,
  };
}

module.exports = { parseScenario };
