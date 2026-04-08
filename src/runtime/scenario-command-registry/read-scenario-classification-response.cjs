/* path: src/runtime/scenario-command-registry/read-scenario-classification-response.cjs */
"use strict";

const fs = require("fs");
const path = require("path");
const YAML = require("yaml");

function getScenarioRegistryConfig(normalizedPlan) {
  const snapshotRuntime =
    normalizedPlan &&
    normalizedPlan.executableCtxSnapshot &&
    normalizedPlan.executableCtxSnapshot.runtime &&
    typeof normalizedPlan.executableCtxSnapshot.runtime === "object"
      ? normalizedPlan.executableCtxSnapshot.runtime
      : {};

  const registry =
    snapshotRuntime.scenario_command_registry &&
    typeof snapshotRuntime.scenario_command_registry === "object"
      ? snapshotRuntime.scenario_command_registry
      : snapshotRuntime.scenarioCommandRegistry &&
        typeof snapshotRuntime.scenarioCommandRegistry === "object"
        ? snapshotRuntime.scenarioCommandRegistry
        : null;

  return registry && typeof registry === "object" ? registry : null;
}

function resolveResponsePath({ projectRoot, responsePath }) {
  if (typeof responsePath !== "string" || responsePath.trim().length === 0) {
    return null;
  }

  const raw = responsePath.trim();
  if (path.isAbsolute(raw)) {
    return raw;
  }

  const baseDir =
    typeof projectRoot === "string" && projectRoot.trim().length > 0
      ? projectRoot
      : process.cwd();

  return path.resolve(baseDir, raw);
}

function parseResponseText({ filePath, raw }) {
  if (/\.json$/i.test(filePath)) {
    return JSON.parse(raw);
  }

  return YAML.parse(raw);
}

function readScenarioClassificationResponse({ normalizedPlan, projectRoot } = {}) {
  const registry = getScenarioRegistryConfig(normalizedPlan);

  if (!registry) {
    return null;
  }

  if (registry.classification_response && typeof registry.classification_response === "object") {
    return registry.classification_response;
  }

  if (registry.classificationResponse && typeof registry.classificationResponse === "object") {
    return registry.classificationResponse;
  }

  const responsePath =
    typeof registry.classification_response_path === "string" &&
    registry.classification_response_path.trim().length > 0
      ? registry.classification_response_path.trim()
      : typeof registry.classificationResponsePath === "string" &&
        registry.classificationResponsePath.trim().length > 0
        ? registry.classificationResponsePath.trim()
        : typeof registry.response_path === "string" && registry.response_path.trim().length > 0
          ? registry.response_path.trim()
          : typeof registry.responsePath === "string" && registry.responsePath.trim().length > 0
            ? registry.responsePath.trim()
            : null;

  const resolvedPath = resolveResponsePath({ projectRoot, responsePath });

  if (!resolvedPath || !fs.existsSync(resolvedPath)) {
    return null;
  }

  const raw = fs.readFileSync(resolvedPath, "utf8");
  const parsed = parseResponseText({ filePath: resolvedPath, raw });

  if (!parsed || typeof parsed !== "object") {
    throw new Error("readScenarioClassificationResponse: response must be an object");
  }

  return parsed;
}

module.exports = {
  readScenarioClassificationResponse,
};
