"use strict";

const { ERROR_CODES } = require("../error-codes.cjs");
const { compilePlan } = require("../compile-plan.cjs");
const { runPlan } = require("../run-plan.cjs");

class ScenarioPolicyError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "ScenarioPolicyError";
    this.code = code;

    if (details && typeof details === "object") {
      this.details = details;
    }
  }
}

function createScenarioPolicyError(code, message, details = undefined) {
  return new ScenarioPolicyError(code, message, details);
}

function normalizeScenarioError(error) {
  if (!error || typeof error !== "object") {
    return createScenarioPolicyError(
      ERROR_CODES.PIPELINE_INTERNAL_ERROR,
      "Unknown scenario runtime error"
    );
  }

  if (error instanceof ScenarioPolicyError) {
    return error;
  }

  const message =
    typeof error.message === "string" && error.message.trim().length > 0
      ? error.message
      : "Unknown scenario runtime error";

  const code =
    typeof error.code === "string" && error.code.trim().length > 0
      ? error.code.trim()
      : ERROR_CODES.PIPELINE_INTERNAL_ERROR;

  const details =
    error.details && typeof error.details === "object" && !Array.isArray(error.details)
      ? error.details
      : undefined;

  return createScenarioPolicyError(code, message, details);
}

async function runScenarioEngine(params) {
  const {
    runbook,
    project,
    executableCtx,
    projectRoot,
    runId = null,
    workspaceDir = null,
  } = params || {};

  try {
    const plan = compilePlan({
      runbook,
      project,
      executionKind: "scenario",
      executableCtx,
    });

    return await runPlan({
      plan,
      projectRoot,
      runId,
      workspaceDir,
    });
  } catch (error) {
    throw normalizeScenarioError(error);
  }
}

module.exports = {
  ScenarioPolicyError,
  createScenarioPolicyError,
  runScenarioEngine,
};
