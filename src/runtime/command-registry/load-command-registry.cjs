/* path: src/runtime/command-registry/load-command-registry.cjs */
"use strict";

const fs = require("fs");
const path = require("path");
const YAML = require("yaml");

function defaultRegistryPath() {
  return path.resolve(__dirname, "..", "..", "..", "config", "command-registry.yaml");
}

function normalizePlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeString(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeString(item))
    .filter(Boolean);
}

function normalizeEntry(entry, index) {
  const source = normalizePlainObject(entry);
  const match = normalizePlainObject(source.match);

  return {
    id: normalizeString(source.id) || `entry-${index + 1}`,
    group: normalizeString(source.group),
    profile: normalizeString(source.profile),
    notes: normalizeString(source.notes),
    readiness: normalizePlainObject(source.readiness),
    match: {
      cmd: normalizeString(match.cmd),
      args_exact: normalizeStringArray(match.args_exact),
      args_prefix: normalizeStringArray(match.args_prefix),
      args_contains: normalizeStringArray(match.args_contains),
      args_contains_any: normalizeStringArray(match.args_contains_any),
    },
  };
}

function loadCommandRegistry(options = {}) {
  const registryPath = normalizeString(options.registryPath) || defaultRegistryPath();

  if (!fs.existsSync(registryPath)) {
    return {
      ok: false,
      registryPath,
      error: {
        code: "COMMAND_REGISTRY_MISSING",
        message: `Command registry not found: ${registryPath}`,
      },
      registry: null,
    };
  }

  let parsed;
  try {
    parsed = YAML.parse(fs.readFileSync(registryPath, "utf8"));
  } catch (error) {
    return {
      ok: false,
      registryPath,
      error: {
        code: "COMMAND_REGISTRY_INVALID",
        message:
          error && error.message
            ? `Failed to parse command registry: ${error.message}`
            : "Failed to parse command registry",
      },
      registry: null,
    };
  }

  const doc = normalizePlainObject(parsed);

  if (Number(doc.version || 0) !== 1) {
    return {
      ok: false,
      registryPath,
      error: {
        code: "COMMAND_REGISTRY_INVALID",
        message: "Command registry version must be 1",
      },
      registry: null,
    };
  }

  const defaults = normalizePlainObject(doc.defaults);

  return {
    ok: true,
    registryPath,
    registry: {
      version: 1,
      defaults: {
        on_unknown: normalizeString(defaults.on_unknown) || "classification_required",
        generate_request: defaults.generate_request !== false,
        execute_unknown: defaults.execute_unknown === true,
      },
      profiles: normalizePlainObject(doc.profiles),
      commands: Array.isArray(doc.commands)
        ? doc.commands.map((entry, index) => normalizeEntry(entry, index))
        : [],
    },
  };
}

module.exports = {
  defaultRegistryPath,
  loadCommandRegistry,
};
