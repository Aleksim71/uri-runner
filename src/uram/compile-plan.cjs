"use strict";

const { ERROR_CODES } = require("./error-codes.cjs");
const {
  PLAN_VERSION,
  PLAN_KIND_SCENARIO,
  assertPlanShape,
} = require("./plan-schema.cjs");

const SUPPORTED_HEALTHCHECK_TYPES = new Set([
  "http_ok",
  "port_open",
  "process_alive",
]);

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

function normalizeEnvironmentPolicy(environment) {
  const source =
    environment && typeof environment === "object" && !Array.isArray(environment)
      ? environment
      : {};

  const startupSource =
    source.startup &&
    typeof source.startup === "object" &&
    !Array.isArray(source.startup)
      ? source.startup
      : {};

  const healthcheckSource =
    startupSource.healthcheck &&
    typeof startupSource.healthcheck === "object" &&
    !Array.isArray(startupSource.healthcheck)
      ? startupSource.healthcheck
      : {};

  return {
    reset_before_run: source.reset_before_run === true,
    managed_processes: Array.isArray(source.managed_processes)
      ? source.managed_processes
      : [],
    startup: {
      command:
        typeof startupSource.command === "string" ? startupSource.command : "",
      healthcheck: {
        type:
          typeof healthcheckSource.type === "string"
            ? healthcheckSource.type
            : "http_ok",
        url:
          typeof healthcheckSource.url === "string"
            ? healthcheckSource.url
            : "",
        timeoutSec: Number.isFinite(healthcheckSource.timeoutSec)
          ? healthcheckSource.timeoutSec
          : 30,
        host:
          typeof healthcheckSource.host === "string"
            ? healthcheckSource.host
            : "",
        port:
          Number.isInteger(healthcheckSource.port) &&
          healthcheckSource.port > 0
            ? healthcheckSource.port
            : null,
        pid:
          Number.isInteger(healthcheckSource.pid) &&
          healthcheckSource.pid > 0
            ? healthcheckSource.pid
            : null,
      },
    },
  };
}

function validateManagedProcess(processEntry, index) {
  if (
    !processEntry ||
    typeof processEntry !== "object" ||
    Array.isArray(processEntry)
  ) {
    throw createPlanCompileError(
      ERROR_CODES.SCENARIO_INVALID,
      "invalid runtime.environment.managed_processes entry: expected object",
      {
        field: `runtime.environment.managed_processes[${index}]`,
      }
    );
  }

  if (
    Object.prototype.hasOwnProperty.call(processEntry, "name") &&
    typeof processEntry.name !== "string"
  ) {
    throw createPlanCompileError(
      ERROR_CODES.SCENARIO_INVALID,
      "invalid runtime.environment.managed_processes entry: name must be a string",
      {
        field: `runtime.environment.managed_processes[${index}].name`,
      }
    );
  }

  if (
    Object.prototype.hasOwnProperty.call(processEntry, "command_contains") &&
    typeof processEntry.command_contains !== "string"
  ) {
    throw createPlanCompileError(
      ERROR_CODES.SCENARIO_INVALID,
      "invalid runtime.environment.managed_processes entry: command_contains must be a string",
      {
        field: `runtime.environment.managed_processes[${index}].command_contains`,
      }
    );
  }

  if (
    Object.prototype.hasOwnProperty.call(processEntry, "ports") &&
    (!Array.isArray(processEntry.ports) ||
      processEntry.ports.some((port) => !Number.isInteger(port) || port <= 0))
  ) {
    throw createPlanCompileError(
      ERROR_CODES.SCENARIO_INVALID,
      "invalid runtime.environment.managed_processes entry: ports must be an array of positive integers",
      {
        field: `runtime.environment.managed_processes[${index}].ports`,
      }
    );
  }
}

function validateEnvironmentPolicy(executableCtx) {
  const runtime =
    executableCtx &&
    executableCtx.runtime &&
    typeof executableCtx.runtime === "object" &&
    !Array.isArray(executableCtx.runtime)
      ? executableCtx.runtime
      : {};

  if (!Object.prototype.hasOwnProperty.call(runtime, "environment")) {
    return normalizeEnvironmentPolicy(undefined);
  }

  const environment = runtime.environment;

  if (!environment || typeof environment !== "object" || Array.isArray(environment)) {
    throw createPlanCompileError(
      ERROR_CODES.SCENARIO_INVALID,
      "invalid runtime.environment: expected object",
      {
        field: "runtime.environment",
      }
    );
  }

  if (
    Object.prototype.hasOwnProperty.call(environment, "reset_before_run") &&
    typeof environment.reset_before_run !== "boolean"
  ) {
    throw createPlanCompileError(
      ERROR_CODES.SCENARIO_INVALID,
      "invalid runtime.environment.reset_before_run: expected boolean",
      {
        field: "runtime.environment.reset_before_run",
      }
    );
  }

  if (
    Object.prototype.hasOwnProperty.call(environment, "managed_processes") &&
    !Array.isArray(environment.managed_processes)
  ) {
    throw createPlanCompileError(
      ERROR_CODES.SCENARIO_INVALID,
      "invalid runtime.environment.managed_processes: expected array",
      {
        field: "runtime.environment.managed_processes",
      }
    );
  }

  const normalized = normalizeEnvironmentPolicy(environment);

  normalized.managed_processes.forEach((entry, index) =>
    validateManagedProcess(entry, index)
  );

  const startup = environment.startup;

  if (
    Object.prototype.hasOwnProperty.call(environment, "startup") &&
    (!startup || typeof startup !== "object" || Array.isArray(startup))
  ) {
    throw createPlanCompileError(
      ERROR_CODES.SCENARIO_INVALID,
      "invalid runtime.environment.startup: expected object",
      {
        field: "runtime.environment.startup",
      }
    );
  }

  if (
    startup &&
    Object.prototype.hasOwnProperty.call(startup, "command") &&
    typeof startup.command !== "string"
  ) {
    throw createPlanCompileError(
      ERROR_CODES.SCENARIO_INVALID,
      "invalid runtime.environment.startup.command: expected string",
      {
        field: "runtime.environment.startup.command",
      }
    );
  }

  const healthcheck = startup && startup.healthcheck;

  if (
    startup &&
    Object.prototype.hasOwnProperty.call(startup, "healthcheck") &&
    (!healthcheck || typeof healthcheck !== "object" || Array.isArray(healthcheck))
  ) {
    throw createPlanCompileError(
      ERROR_CODES.SCENARIO_INVALID,
      "invalid runtime.environment.startup.healthcheck: expected object",
      {
        field: "runtime.environment.startup.healthcheck",
      }
    );
  }

  if (
    healthcheck &&
    Object.prototype.hasOwnProperty.call(healthcheck, "type") &&
    typeof healthcheck.type !== "string"
  ) {
    throw createPlanCompileError(
      ERROR_CODES.SCENARIO_INVALID,
      "invalid runtime.environment.startup.healthcheck.type: expected string",
      {
        field: "runtime.environment.startup.healthcheck.type",
      }
    );
  }

  if (!SUPPORTED_HEALTHCHECK_TYPES.has(normalized.startup.healthcheck.type)) {
    throw createPlanCompileError(
      ERROR_CODES.SCENARIO_INVALID,
      "invalid runtime.environment.startup.healthcheck.type: unsupported value",
      {
        field: "runtime.environment.startup.healthcheck.type",
        supportedValues: Array.from(SUPPORTED_HEALTHCHECK_TYPES),
      }
    );
  }

  if (
    healthcheck &&
    Object.prototype.hasOwnProperty.call(healthcheck, "timeoutSec") &&
    (!Number.isFinite(healthcheck.timeoutSec) || healthcheck.timeoutSec <= 0)
  ) {
    throw createPlanCompileError(
      ERROR_CODES.SCENARIO_INVALID,
      "invalid runtime.environment.startup.healthcheck.timeoutSec: expected positive number",
      {
        field: "runtime.environment.startup.healthcheck.timeoutSec",
      }
    );
  }

  if (
    healthcheck &&
    Object.prototype.hasOwnProperty.call(healthcheck, "url") &&
    typeof healthcheck.url !== "string"
  ) {
    throw createPlanCompileError(
      ERROR_CODES.SCENARIO_INVALID,
      "invalid runtime.environment.startup.healthcheck.url: expected string",
      {
        field: "runtime.environment.startup.healthcheck.url",
      }
    );
  }

  if (
    healthcheck &&
    Object.prototype.hasOwnProperty.call(healthcheck, "host") &&
    typeof healthcheck.host !== "string"
  ) {
    throw createPlanCompileError(
      ERROR_CODES.SCENARIO_INVALID,
      "invalid runtime.environment.startup.healthcheck.host: expected string",
      {
        field: "runtime.environment.startup.healthcheck.host",
      }
    );
  }

  if (
    healthcheck &&
    Object.prototype.hasOwnProperty.call(healthcheck, "port") &&
    healthcheck.port !== null &&
    (!Number.isInteger(healthcheck.port) || healthcheck.port <= 0)
  ) {
    throw createPlanCompileError(
      ERROR_CODES.SCENARIO_INVALID,
      "invalid runtime.environment.startup.healthcheck.port: expected positive integer",
      {
        field: "runtime.environment.startup.healthcheck.port",
      }
    );
  }

  if (
    healthcheck &&
    Object.prototype.hasOwnProperty.call(healthcheck, "pid") &&
    healthcheck.pid !== null &&
    (!Number.isInteger(healthcheck.pid) || healthcheck.pid <= 0)
  ) {
    throw createPlanCompileError(
      ERROR_CODES.SCENARIO_INVALID,
      "invalid runtime.environment.startup.healthcheck.pid: expected positive integer",
      {
        field: "runtime.environment.startup.healthcheck.pid",
      }
    );
  }

  if (
    normalized.startup.healthcheck.type === "http_ok" &&
    normalized.startup.healthcheck.url.trim().length === 0
  ) {
    throw createPlanCompileError(
      ERROR_CODES.SCENARIO_INVALID,
      "invalid runtime.environment.startup.healthcheck.url: required for http_ok",
      {
        field: "runtime.environment.startup.healthcheck.url",
      }
    );
  }

  if (
    normalized.startup.healthcheck.type === "port_open" &&
    !Number.isInteger(normalized.startup.healthcheck.port)
  ) {
    throw createPlanCompileError(
      ERROR_CODES.SCENARIO_INVALID,
      "invalid runtime.environment.startup.healthcheck.port: required for port_open",
      {
        field: "runtime.environment.startup.healthcheck.port",
      }
    );
  }

  if (
    normalized.startup.healthcheck.type === "process_alive" &&
    !Number.isInteger(normalized.startup.healthcheck.pid)
  ) {
    throw createPlanCompileError(
      ERROR_CODES.SCENARIO_INVALID,
      "invalid runtime.environment.startup.healthcheck.pid: required for process_alive",
      {
        field: "runtime.environment.startup.healthcheck.pid",
      }
    );
  }

  return normalized;
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
    environment: validateEnvironmentPolicy(executableCtx),
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
      runtime: {
        ...(executableCtx?.runtime || {}),
        environment: runtime.environment,
      },
    },
    steps: compiledSteps,
  };

  return assertPlanShape(draftPlan);
}

module.exports = {
  PlanCompileError,
  createPlanCompileError,
  getCommandRoot,
  validateEnvironmentPolicy,
  compilePlan,
};
