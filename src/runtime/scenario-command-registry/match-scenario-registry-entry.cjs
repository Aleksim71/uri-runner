/* path: src/runtime/scenario-command-registry/match-scenario-registry-entry.cjs */
"use strict";

function matchScenarioRegistryEntry({ step, registry }) {
  if (!step || typeof step !== "object" || !registry || typeof registry !== "object") {
    return null;
  }

  if (step.kind === "browser") {
    for (const entry of Array.isArray(registry.browserActions) ? registry.browserActions : []) {
      if (entry && entry.match && entry.match.action === step.action) {
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
