/* path: src/runtime/scenario-command-registry/preflight-scenario-plan.cjs */
"use strict";

const {
  defaultScenarioRegistryPath,
  loadScenarioCommandRegistry,
} = require("./load-scenario-command-registry.cjs");
const {
  matchScenarioRegistryEntry,
} = require("./match-scenario-registry-entry.cjs");
const {
  buildScenarioClassificationRequest,
} = require("./build-scenario-classification-request.cjs");

function preflightScenarioPlan({
  plan,
  registryPath = defaultScenarioRegistryPath(),
  generatedAt,
} = {}) {
  if (!plan || typeof plan !== "object") {
    throw new Error("preflightScenarioPlan: plan is required");
  }

  const registry = loadScenarioCommandRegistry(registryPath);
  const steps = Array.isArray(plan.steps) ? plan.steps : [];
  const matchedSteps = [];
  const unknownSteps = [];

  for (const step of steps) {
    if (!step || typeof step !== "object") {
      continue;
    }

    if (step.kind && step.kind !== "command" && step.kind !== "browser") {
      continue;
    }

    const matchedEntry = matchScenarioRegistryEntry({ step, registry });

    if (matchedEntry) {
      matchedSteps.push({
        stepId: step.stepId || null,
        kind: step.kind || "command",
        command: step.command || null,
        action: step.action || null,
        registryId: matchedEntry.id || null,
      });
      continue;
    }

    unknownSteps.push(step);
  }

  if (unknownSteps.length > 0) {
    return {
      status: "classification_required",
      registryPath: registry.registryPath,
      matchedSteps,
      unknownSteps,
      classificationRequest: buildScenarioClassificationRequest({
        plan,
        unknownSteps,
        registryPath: registry.registryPath,
        generatedAt,
      }),
    };
  }

  return {
    status: "ok",
    registryPath: registry.registryPath,
    matchedSteps,
    unknownSteps: [],
    classificationRequest: null,
  };
}

module.exports = {
  preflightScenarioPlan,
};
