/* path: src/runtime/scenario-command-registry/match-scenario-registry-entry.cjs */
"use strict";

function getBrowserAction(step) {
  if (!step || typeof step !== "object") {
    return null;
  }

  if (typeof step.action === "string" && step.action.trim().length > 0) {
    return step.action.trim();
  }

  if (typeof step.command === "string" && step.command.startsWith("browser.")) {
    return step.command.slice("browser.".length).trim() || null;
  }

  return null;
}

function matchScenarioRegistryEntry({ step, registry }) {
  if (!step || typeof step !== "object" || !registry || typeof registry !== "object") {
    return null;
  }

  if (step.kind === "browser") {
    const action = getBrowserAction(step);

    for (const entry of Array.isArray(registry.browserActions) ? registry.browserActions : []) {
      if (entry && entry.match && entry.match.action === action) {
        return entry;
      }
    }

    return null;
  }

  if (!step.kind || step.kind === "command") {
    for (const entry of Array.isArray(registry.namedCommands) ? registry.namedCommands : []) {
      if (entry && entry.match && entry.match.command === step.command) {
        return entry;
      }
    }

    return null;
  }

  return null;
}

module.exports = {
  matchScenarioRegistryEntry,
};
