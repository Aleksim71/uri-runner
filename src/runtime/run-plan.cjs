"use strict";

const path = require("path");

const { assertPlanShape } = require("./plan-schema.cjs");
const { buildRuntimePaths } = require("../runtime/runtime-paths.cjs");

const { loadPlanCommands } = require("./load-plan-commands.cjs");
const { executePlanStep } = require("./execute-plan-step.cjs");

const { resetEnvironment } = require("../runtime/environment/reset-environment.cjs");

class PlanRunError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "PlanRunError";
    this.code = code;

    if (details && typeof details === "object") {
      this.details = details;
    }
  }
}

function createPlanRunError(code, message, details = undefined) {
  return new PlanRunError(code, message, details);
}

async function runPlan(params) {
  const {
    plan,
    projectRoot,
    runId,
    workspaceDir,
  } = params || {};

  const normalizedPlan = assertPlanShape(plan);

  const loadedCommands = [];

  const commands = await loadPlanCommands({
    projectRoot,
    roots: normalizedPlan.executableCtxSnapshot.commands.roots || [],
    loadedCommands,
  });

  const runtimePaths = buildRuntimePaths({
    projectRoot,
    runId,
    workspaceDir,
  });

  const executionContext = {
    runId,
    workspaceDir,
    projectRoot,
    runtimePaths,
    commands,
    loadedCommands,
    plan: normalizedPlan,
    results: [],
  };

  const environmentPolicy =
    normalizedPlan.runtime && normalizedPlan.runtime.environment
      ? normalizedPlan.runtime.environment
      : null;

  if (environmentPolicy && environmentPolicy.reset_before_run === true) {
    const environmentReset = await resetEnvironment({
      projectRoot,
      workspaceDir,
      policy: environmentPolicy,
    });

    executionContext.environmentReset = environmentReset;
  }

  let stepsCompleted = 0;

  for (const step of normalizedPlan.steps) {
    const result = await executePlanStep({
      step,
      context: executionContext,
    });

    executionContext.results.push(result);

    if (!result.ok) {
      return {
        exitCode: 1,
        ok: false,
        meta: {
          loadedCommands,
          planRun: {
            executionStatus: "failed",
            stepsCompleted,
          },
        },
        outboxPayload: {
          result: {
            results: executionContext.results,
          },
        },
      };
    }

    stepsCompleted += 1;
  }

  return {
    exitCode: 0,
    ok: true,
    meta: {
      loadedCommands,
      planRun: {
        executionStatus: "success",
        stepsCompleted,
      },
    },
    outboxPayload: {
      result: {
        results: executionContext.results,
      },
    },
  };
}

module.exports = {
  runPlan,
  PlanRunError,
  createPlanRunError,
};
