/* path: src/runtime/scenario-command-registry/load-scenario-command-registry.cjs */
"use strict";

const fs = require("fs");
const path = require("path");
const YAML = require("yaml");

function defaultScenarioRegistryPath() {
  return path.resolve(
    __dirname,
    "..",
    "..",
    "..",
    "config",
    "scenario-command-registry.yaml"
  );
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => String(item || "").trim())
    .filter(Boolean);
}

function normalizeMatch(value) {
  if (!value || typeof value !== "object") {
    return {};
  }

  const match = {};

  if (typeof value.command === "string" && value.command.trim().length > 0) {
    match.command = value.command.trim();
  }

  if (typeof value.action === "string" && value.action.trim().length > 0) {
    match.action = value.action.trim();
  }

  return match;
}

function normalizeRegistryEntry(entry) {
  const source = entry && typeof entry === "object" ? entry : {};

  return {
    id:
      typeof source.id === "string" && source.id.trim().length > 0
        ? source.id.trim()
        : null,
    group:
      typeof source.group === "string" && source.group.trim().length > 0
        ? source.group.trim()
        : null,
    profile:
      typeof source.profile === "string" && source.profile.trim().length > 0
        ? source.profile.trim()
        : null,
    notes:
      typeof source.notes === "string" && source.notes.trim().length > 0
        ? source.notes.trim()
        : null,
    match: normalizeMatch(source.match),
    argsSchema: {
      required: normalizeStringArray(source.args_schema && source.args_schema.required),
      optional: normalizeStringArray(source.args_schema && source.args_schema.optional),
    },
  };
}

function loadScenarioCommandRegistry(registryPath = defaultScenarioRegistryPath()) {
  const resolvedPath = path.resolve(registryPath);
  const raw = fs.readFileSync(resolvedPath, "utf8");
  const parsed = YAML.parse(raw);

  if (!parsed || typeof parsed !== "object") {
    throw new Error("loadScenarioCommandRegistry: registry must be an object");
  }

  return {
    registryPath: resolvedPath,
    version: Number.isInteger(parsed.version) ? parsed.version : 1,
    defaults:
      parsed.defaults && typeof parsed.defaults === "object" ? parsed.defaults : {},
    namedCommands: Array.isArray(parsed.named_commands)
      ? parsed.named_commands.map(normalizeRegistryEntry)
      : [],
    browserActions: Array.isArray(parsed.browser_actions)
      ? parsed.browser_actions.map(normalizeRegistryEntry)
      : [],
  };
}

module.exports = {
  defaultScenarioRegistryPath,
  loadScenarioCommandRegistry,
};
