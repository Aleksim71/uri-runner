"use strict";

const { ERROR_CODES } = require("./error-codes.cjs");
const {
  PLAN_VERSION,
  PLAN_KIND_SCENARIO,
  assertPlanShape,
} = require("./plan-schema.cjs");

class PlanCompileError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "PlanCompileError";
    this.code = code;

    if (details && typeof details === "object") {
      this.details = details;
    }
  }
}

function createPlanCompileError(code, message, details = undefined) {
  return new PlanCompileError(code, message, details);
}

function getCommandRoot(commandName) {
  if (typeof commandName !== "string") {
    return "";
  }

  const dotIndex = commandName.indexOf(".");
  if (dotIndex === -1) {
    return commandName.trim();
  }

  return commandName.slice(0, dotIndex).trim();
}

function assertScenarioEngine(executableCtx) {
  const engine = executableCtx && executableCtx.engine;

  if (engine !== "scenario") {
    throw createPlanCompileError(
      ERROR_CODES.ENGINE_NOT_ALLOWED,
      `Engine not allowed: ${String(engine || "") || "unknown"}`,
      {
        engine,
        expected: "scenario",
      }
    );
  }
}

function getAllowedRoots(executableCtx) {
  const roots =
    executableCtx &&
    executableCtx.commands &&
    Array.isArray(executableCtx.commands.roots)
      ? executableCtx.commands.roots
      : [];

  return roots;
}

function getRuntimeOptions(executableCtx) {
  const runtime =
    executableCtx &&
    executableCtx.runtime &&
    typeof executableCtx.runtime === "object"
      ? executableCtx.runtime
      : {};

  return {
    maxSteps: Number.isFinite(runtime.max_steps) ? runtime.max_steps : null,
    strictCommands: runtime.strict_commands === true,
  };
}

function validateRunbookSteps(runbook) {
  const steps = runbook && runbook.steps;

  if (!Array.isArray(steps) || steps.length === 0) {
    throw createPlanCompileError(
      ERROR_CODES.SCENARIO_INVALID,
      "Scenario runbook is invalid: steps must be a non-empty array",
      {
        field: "steps",
      }
    );
  }

  return steps;
}

function validateMaxSteps(steps, executableCtx) {
  const { maxSteps } = getRuntimeOptions(executableCtx);

  if (maxSteps !== null && steps.length > maxSteps) {
    throw createPlanCompileError(
      ERROR_CODES.MAX_STEPS_EXCEEDED,
      `Scenario max steps exceeded: ${steps.length} > ${maxSteps}`,
      {
        maxSteps,
        actualSteps: steps.length,
      }
    );
  }
}

function compileScenarioStep(step, index, executableCtx) {
  if (!step || typeof step !== "object") {
    throw createPlanCompileError(
      ERROR_CODES.SCENARIO_INVALID,
      "Scenario step is invalid: step must be an object",
      {
        stepIndex: index,
      }
    );
  }

  const stepId =
    typeof step.id === "string" && step.id.trim().length > 0
      ? step.id.trim()
      : null;

  if (!stepId) {
    throw createPlanCompileError(
      ERROR_CODES.SCENARIO_INVALID,
      "Scenario step is invalid: id is required",
      {
        stepIndex: index,
      }
    );
  }

  const command =
    typeof step.command === "string" && step.command.trim().length > 0
      ? step.command.trim()
      : null;

  if (!command) {
    throw createPlanCompileError(
      ERROR_CODES.SCENARIO_INVALID,
      "Scenario step is invalid: command is missing",
      {
        stepIndex: index,
        stepId,
      }
    );
  }

  const allowedRoots = getAllowedRoots(executableCtx);
  const commandRoot = getCommandRoot(command);

  if (!commandRoot) {
    throw createPlanCompileError(
      ERROR_CODES.SCENARIO_INVALID,
      "Scenario step is invalid: command root is missing",
      {
        stepIndex: index,
        stepId,
        command,
      }
    );
  }

  if (!allowedRoots.includes(commandRoot)) {
    throw createPlanCompileError(
      ERROR_CODES.COMMAND_ROOT_NOT_ALLOWED,
      `Command root not allowed: ${commandRoot}`,
      {
        stepIndex: index,
        stepId,
        command,
        commandRoot,
        allowedRoots,
      }
    );
  }

  const args =
    step.args && typeof step.args === "object" && !Array.isArray(step.args)
      ? step.args
      : {};

  return {
    kind: "command",
    stepId,
    index,
    command,
    commandRoot,
    args,
  };
}

function compilePlan(params) {
  const {
    runbook,
    project,
    executionKind = "scenario",
    executableCtx,
  } = params || {};

  if (executionKind !== "scenario") {
    throw createPlanCompileError(
      ERROR_CODES.ENGINE_NOT_ALLOWED,
      `Engine not allowed: ${executionKind}`,
      {
        executionKind,
        expected: "scenario",
      }
    );
  }

  assertScenarioEngine(executableCtx);

  const steps = validateRunbookSteps(runbook);
  validateMaxSteps(steps, executableCtx);

  const compiledSteps = steps.map((step, index) =>
    compileScenarioStep(step, index, executableCtx)
  );

  const runtime = getRuntimeOptions(executableCtx);

  const draftPlan = {
    version: PLAN_VERSION,
    kind: PLAN_KIND_SCENARIO,
    engine: "scenario",
    project: project || runbook?.project || "unknown",
    runtime,
    executableCtxSnapshot: {
      engine: executableCtx?.engine || null,
      commands: executableCtx?.commands || {},
      runtime: executableCtx?.runtime || {},
    },
    steps: compiledSteps,
  };

  return assertPlanShape(draftPlan);
}

module.exports = {
  PlanCompileError,
  createPlanCompileError,
  getCommandRoot,
  compilePlan,
};
