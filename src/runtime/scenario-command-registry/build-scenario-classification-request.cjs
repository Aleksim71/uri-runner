/* path: src/runtime/scenario-command-registry/build-scenario-classification-request.cjs */
"use strict";

function getStepArgs(step) {
  if (step && step.args && typeof step.args === "object" && !Array.isArray(step.args)) {
    return step.args;
  }

  return {};
}

function buildUnknownStepDescriptor(step, index) {
  const args = getStepArgs(step);

  if (step && step.kind === "browser") {
    return {
      source: `steps[${index}]`,
      step_id: step.stepId || null,
      kind: "browser",
      action: step.action || null,
      args_keys: Object.keys(args).sort(),
      suggested_match: {
        action: step.action || null,
      },
    };
  }

  return {
    source: `steps[${index}]`,
    step_id: step && step.stepId ? step.stepId : null,
    kind: step && step.kind ? step.kind : "command",
    command: step && step.command ? step.command : null,
    command_root:
      step && typeof step.commandRoot === "string" && step.commandRoot.trim().length > 0
        ? step.commandRoot.trim()
        : null,
    args_keys: Object.keys(args).sort(),
    suggested_match: {
      command: step && step.command ? step.command : null,
    },
  };
}

function buildScenarioClassificationRequest({
  plan,
  unknownSteps,
  registryPath,
  generatedAt,
}) {
  const steps = Array.isArray(unknownSteps) ? unknownSteps : [];

  return {
    version: 1,
    status: "classification_required",
    engine: "scenario",
    generated_at:
      typeof generatedAt === "string" && generatedAt.trim().length > 0
        ? generatedAt.trim()
        : new Date().toISOString(),
    project:
      plan && typeof plan.project === "string" && plan.project.trim().length > 0
        ? plan.project.trim()
        : null,
    registry_path:
      typeof registryPath === "string" && registryPath.trim().length > 0
        ? registryPath.trim()
        : null,
    unknown_steps: steps.map((item, index) => buildUnknownStepDescriptor(item, index)),
  };
}

module.exports = {
  buildScenarioClassificationRequest,
};
