"use strict";

const fs = require("fs/promises");
const path = require("path");

const { ERROR_CODES } = require("./error-codes.cjs");
const {
  assertPlanShape,
  PLAN_KIND_MATERIALIZED,
} = require("./plan-schema.cjs");
const {
  resetEnvironment,
} = require("../runtime/environment/reset-environment.cjs");

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

function uniquePaths(paths) {
  return [...new Set(paths.filter(Boolean).map((p) => path.resolve(p)))];
}

function normalizeLoadedCommands(commandMap) {
  if (!commandMap || typeof commandMap !== "object") {
    return [];
  }

  return Object.keys(commandMap).sort();
}

function getSystemCommandDirs(projectRoot) {
  return uniquePaths([
    path.join(projectRoot, "contexts", "system", "commands"),
    path.join(projectRoot, "commands", "system"),
    path.join(__dirname, "commands", "system"),
    path.join(__dirname, "..", "commands", "system"),
    path.join(process.cwd(), "src", "uram", "commands", "system"),
    path.join(process.cwd(), "src", "commands", "system"),
  ]);
}

function getProjectCommandDirs(projectRoot) {
  return uniquePaths([
    path.join(projectRoot, "contexts", "project", "commands"),
    path.join(projectRoot, "contexts", "project"),
    path.join(projectRoot, "commands", "project"),
  ]);
}

async function tryLoadCommandDir(dirPath, namespace, target) {
  let entries = [];
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    if (!entry.name.endsWith(".cjs")) {
      continue;
    }

    const absolutePath = path.join(dirPath, entry.name);
    const commandBaseName = entry.name.replace(/\.cjs$/, "");
    const commandName = `${namespace}.${commandBaseName}`;

    delete require.cache[require.resolve(absolutePath)];
    const mod = require(absolutePath);

    if (typeof mod === "function") {
      target[commandName] = mod;
      continue;
    }

    if (mod && typeof mod.run === "function") {
      target[commandName] = mod.run;
    }
  }
}

async function loadPlanCommands({ projectRoot, executableCtxSnapshot }) {
  const roots =
    executableCtxSnapshot &&
    executableCtxSnapshot.commands &&
    Array.isArray(executableCtxSnapshot.commands.roots)
      ? executableCtxSnapshot.commands.roots
      : [];

  const commands = {};

  for (const root of roots) {
    if (root === "system") {
      for (const dirPath of getSystemCommandDirs(projectRoot)) {
        await tryLoadCommandDir(dirPath, "system", commands);
      }
      continue;
    }

    if (root === "project") {
      for (const dirPath of getProjectCommandDirs(projectRoot)) {
        await tryLoadCommandDir(dirPath, "project", commands);
      }
    }
  }

  return commands;
}

function ensureProjectRoot(projectRoot) {
  if (typeof projectRoot !== "string" || projectRoot.trim().length === 0) {
    throw createPlanRunError(
      ERROR_CODES.PIPELINE_INTERNAL_ERROR,
      "projectRoot is required for plan execution"
    );
  }

  return path.resolve(projectRoot);
}

function assertSafeRelativePath(relPath, fieldName = "path") {
  if (typeof relPath !== "string" || relPath.trim().length === 0) {
    throw createPlanRunError(
      ERROR_CODES.SCENARIO_INVALID,
      `${fieldName} must be a non-empty string`,
      { field: fieldName }
    );
  }

  const normalized = relPath.replace(/\\/g, "/").trim();

  if (normalized.includes("\0")) {
    throw createPlanRunError(
      ERROR_CODES.SCENARIO_INVALID,
      `${fieldName} must not contain NUL bytes`,
      { field: fieldName, value: relPath }
    );
  }

  if (path.isAbsolute(normalized)) {
    throw createPlanRunError(
      ERROR_CODES.SCENARIO_INVALID,
      `${fieldName} must be relative to project root`,
      { field: fieldName, value: relPath }
    );
  }

  const parts = normalized.split("/");

  if (parts.some((part) => part === "..")) {
    throw createPlanRunError(
      ERROR_CODES.SCENARIO_INVALID,
      `${fieldName} must not escape project root`,
      { field: fieldName, value: relPath }
    );
  }

  if (parts.some((part) => part.trim().length === 0)) {
    throw createPlanRunError(
      ERROR_CODES.SCENARIO_INVALID,
      `${fieldName} contains an invalid path segment`,
      { field: fieldName, value: relPath }
    );
  }

  return normalized;
}

function resolveProjectFilePath(projectRoot, relPath) {
  const safeRoot = ensureProjectRoot(projectRoot);
  const safeRelPath = assertSafeRelativePath(relPath, "payload.path");
  const absolutePath = path.resolve(safeRoot, safeRelPath);

  const relativeCheck = path.relative(safeRoot, absolutePath);

  if (
    relativeCheck === ".." ||
    relativeCheck.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativeCheck)
  ) {
    throw createPlanRunError(
      ERROR_CODES.SCENARIO_INVALID,
      "payload.path resolved outside project root",
      {
        field: "payload.path",
        value: relPath,
      }
    );
  }

  return {
    relativePath: safeRelPath,
    absolutePath,
  };
}

async function executeProvideFileReadStep(step, context) {
  const payload =
    step && step.payload && typeof step.payload === "object" ? step.payload : {};

  const { relativePath, absolutePath } = resolveProjectFilePath(
    context.projectRoot,
    payload.path
  );

  let stat;
  try {
    stat = await fs.stat(absolutePath);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      throw createPlanRunError(
        ERROR_CODES.SCENARIO_INVALID,
        `Requested file not found: ${relativePath}`,
        {
          stepId: step.stepId || null,
          type: step.type || "provide",
          action: step.action || "file.read",
          path: relativePath,
        }
      );
    }

    throw createPlanRunError(
      ERROR_CODES.PIPELINE_INTERNAL_ERROR,
      `Failed to stat requested file: ${relativePath}`,
      {
        stepId: step.stepId || null,
        type: step.type || "provide",
        action: step.action || "file.read",
        path: relativePath,
        cause: error && error.message ? error.message : String(error),
      }
    );
  }

  if (!stat.isFile()) {
    throw createPlanRunError(
      ERROR_CODES.SCENARIO_INVALID,
      `Requested path is not a file: ${relativePath}`,
      {
        stepId: step.stepId || null,
        type: step.type || "provide",
        action: step.action || "file.read",
        path: relativePath,
      }
    );
  }

  const content = await fs.readFile(absolutePath, "utf8");

  return {
    kind: "file",
    path: relativePath,
    absolutePath,
    content,
  };
}

async function executeGoalCheckStep(step) {
  const payload =
    step && step.payload && typeof step.payload === "object" ? step.payload : {};

  return {
    acknowledged: true,
    text: typeof payload.text === "string" ? payload.text : "",
  };
}

async function runMaterializedPlan(normalizedPlan, params) {
  const executionContext = {
    runId: params.runId || null,
    workspaceDir: params.workspaceDir || null,
    projectRoot: params.projectRoot,
    results: [],
  };

  const startedAt = new Date().toISOString();
  let failedStep = null;

  for (const step of normalizedPlan.steps) {
    try {
      let value;

      if (step.type === "provide" && step.action === "file.read") {
        value = await executeProvideFileReadStep(step, executionContext);
      } else if (step.type === "check" && step.action === "goal.check") {
        value = await executeGoalCheckStep(step);
      } else {
        throw createPlanRunError(
          ERROR_CODES.SCENARIO_INVALID,
          `Unsupported materialized step: ${step.type}:${step.action}`,
          {
            stepId: step.stepId || null,
            type: step.type,
            action: step.action,
          }
        );
      }

      executionContext.results.push({
        stepId: step.stepId || null,
        command: null,
        type: step.type || null,
        action: step.action || null,
        ok: true,
        value: value === undefined ? null : value,
      });
    } catch (error) {
      failedStep = step.stepId || null;
      const finishedAt = new Date().toISOString();

      executionContext.results.push({
        stepId: step.stepId || null,
        command: null,
        type: step.type || null,
        action: step.action || null,
        ok: false,
        error: {
          code: error?.code || ERROR_CODES.PIPELINE_INTERNAL_ERROR,
          message: error?.message || "Step execution failed",
          details:
            error && error.details && typeof error.details === "object"
              ? error.details
              : {},
        },
      });

      return {
        exitCode: 1,
        outboxPayload: {
          ok: false,
          engine: normalizedPlan.engine,
          project: normalizedPlan.project,
          loaded_commands: [],
          result: {
            results: executionContext.results,
          },
        },
        meta: {
          loadedCommands: [],
          error: {
            code: error?.code || ERROR_CODES.PIPELINE_INTERNAL_ERROR,
            message: error?.message || "Step execution failed",
            details:
              error && error.details && typeof error.details === "object"
                ? error.details
                : {},
          },
          planRun: {
            startedAt,
            finishedAt,
            executionStatus: "failed",
            stepsTotal: normalizedPlan.steps.length,
            stepsCompleted: executionContext.results.length,
            failedStep,
          },
        },
      };
    }
  }

  const finishedAt = new Date().toISOString();

  return {
    exitCode: 0,
    outboxPayload: {
      ok: true,
      engine: normalizedPlan.engine,
      project: normalizedPlan.project,
      loaded_commands: [],
      result: {
        results: executionContext.results,
      },
    },
    meta: {
      loadedCommands: [],
      planRun: {
        startedAt,
        finishedAt,
        executionStatus: "success",
        stepsTotal: normalizedPlan.steps.length,
        stepsCompleted: executionContext.results.length,
        failedStep: null,
      },
    },
  };
}

function getScenarioRuntime(normalizedPlan) {
  const runtime =
    normalizedPlan &&
    normalizedPlan.runtime &&
    typeof normalizedPlan.runtime === "object"
      ? normalizedPlan.runtime
      : {};

  const snapshotRuntime =
    normalizedPlan &&
    normalizedPlan.executableCtxSnapshot &&
    normalizedPlan.executableCtxSnapshot.runtime &&
    typeof normalizedPlan.executableCtxSnapshot.runtime === "object"
      ? normalizedPlan.executableCtxSnapshot.runtime
      : {};

  const strictCommands =
    runtime.strictCommands === true ||
    snapshotRuntime.strict_commands === true;

  const maxSteps = Number.isFinite(runtime.maxSteps)
    ? runtime.maxSteps
    : Number.isFinite(snapshotRuntime.max_steps)
      ? snapshotRuntime.max_steps
      : null;

  const runtimeEnvironment =
    runtime.environment && typeof runtime.environment === "object"
      ? runtime.environment
      : null;

  const snapshotEnvironment =
    snapshotRuntime.environment && typeof snapshotRuntime.environment === "object"
      ? snapshotRuntime.environment
      : null;

  const environment = {
    ...(snapshotEnvironment || {}),
    ...(runtimeEnvironment || {}),
  };

  return {
    strictCommands,
    maxSteps,
    environment: Object.keys(environment).length > 0 ? environment : null,
  };
}

async function runScenarioPlan(normalizedPlan, params) {
  const projectRoot = ensureProjectRoot(params.projectRoot);

  const commands = await loadPlanCommands({
    projectRoot,
    executableCtxSnapshot: normalizedPlan.executableCtxSnapshot,
  });

  const loadedCommands = normalizeLoadedCommands(commands);
  const runtime = getScenarioRuntime(normalizedPlan);
  const strictCommands = runtime.strictCommands === true;
  const maxSteps = runtime.maxSteps;

  if (Number.isFinite(maxSteps) && normalizedPlan.steps.length > maxSteps) {
    throw createPlanRunError(
      ERROR_CODES.MAX_STEPS_EXCEEDED,
      `Plan exceeds runtime.maxSteps: ${normalizedPlan.steps.length} > ${maxSteps}`,
      {
        maxSteps,
        steps: normalizedPlan.steps.length,
      }
    );
  }

  const executionContext = {
    runId: params.runId || null,
    workspaceDir: params.workspaceDir || null,
    projectRoot,
    commands,
    loadedCommands,
    plan: normalizedPlan,
    results: [],
  };

  const environmentPolicy = runtime.environment;
  const shouldResetBeforeRun =
    environmentPolicy &&
    (
      environmentPolicy.reset_before_run === true ||
      environmentPolicy.resetBeforeRun === true
    );

  if (shouldResetBeforeRun) {
    const environmentReset = await resetEnvironment({
      environment: environmentPolicy,
      cwd: projectRoot,
      workspaceDir: params.workspaceDir || null,
    });

    executionContext.environmentReset = environmentReset;
  }

  const startedAt = new Date().toISOString();
  let failedStep = null;

  for (const step of normalizedPlan.steps) {
    const commandFn = commands[step.command];

    if (typeof commandFn !== "function") {
      const notFoundError = createPlanRunError(
        ERROR_CODES.COMMAND_NOT_FOUND,
        `Command not found: ${step.command}`,
        {
          commandNames: [step.command],
        }
      );

      if (strictCommands) {
        throw notFoundError;
      }

      failedStep = step.stepId || null;
      const finishedAt = new Date().toISOString();

      executionContext.results.push({
        stepId: step.stepId || null,
        command: step.command || null,
        ok: false,
        error: {
          code: notFoundError.code,
          message: notFoundError.message,
          details: notFoundError.details || {},
        },
      });

      return {
        exitCode: 1,
        outboxPayload: {
          ok: false,
          engine: normalizedPlan.engine,
          project: normalizedPlan.project,
          loaded_commands: loadedCommands,
          result: {
            results: executionContext.results,
          },
        },
        meta: {
          loadedCommands,
          error: {
            code: notFoundError.code,
            message: notFoundError.message,
            details: notFoundError.details || {},
          },
          planRun: {
            startedAt,
            finishedAt,
            executionStatus: "failed",
            stepsTotal: normalizedPlan.steps.length,
            stepsCompleted: executionContext.results.length,
            failedStep,
          },
        },
      };
    }

    try {
      const value = await commandFn({
        id: step.stepId,
        command: step.command,
        args: step.args || {},
        context: executionContext,
      });

      executionContext.results.push({
        stepId: step.stepId || null,
        command: step.command || null,
        ok: true,
        value: value === undefined ? null : value,
      });
    } catch (error) {
      failedStep = step.stepId || null;
      const finishedAt = new Date().toISOString();

      executionContext.results.push({
        stepId: step.stepId || null,
        command: step.command || null,
        ok: false,
        error: {
          code: error?.code || ERROR_CODES.PIPELINE_INTERNAL_ERROR,
          message: error?.message || "Step execution failed",
          details:
            error && error.details && typeof error.details === "object"
              ? error.details
              : {},
        },
      });

      return {
        exitCode: 1,
        outboxPayload: {
          ok: false,
          engine: normalizedPlan.engine,
          project: normalizedPlan.project,
          loaded_commands: loadedCommands,
          result: {
            results: executionContext.results,
          },
        },
        meta: {
          loadedCommands,
          error: {
            code: error?.code || ERROR_CODES.PIPELINE_INTERNAL_ERROR,
            message: error?.message || "Step execution failed",
            details:
              error && error.details && typeof error.details === "object"
                ? error.details
                : {},
          },
          planRun: {
            startedAt,
            finishedAt,
            executionStatus: "failed",
            stepsTotal: normalizedPlan.steps.length,
            stepsCompleted: executionContext.results.length,
            failedStep,
          },
        },
      };
    }
  }

  const finishedAt = new Date().toISOString();

  return {
    exitCode: 0,
    outboxPayload: {
      ok: true,
      engine: normalizedPlan.engine,
      project: normalizedPlan.project,
      loaded_commands: loadedCommands,
      result: {
        results: executionContext.results,
      },
    },
    meta: {
      loadedCommands,
      planRun: {
        startedAt,
        finishedAt,
        executionStatus: "success",
        stepsTotal: normalizedPlan.steps.length,
        stepsCompleted: executionContext.results.length,
        failedStep: null,
      },
    },
  };
}

async function runPlan(params) {
  const {
    plan,
    projectRoot,
    runId = null,
    workspaceDir = null,
  } = params || {};

  const normalizedPlan = assertPlanShape(plan);

  if (normalizedPlan.kind === PLAN_KIND_MATERIALIZED) {
    return runMaterializedPlan(normalizedPlan, {
      projectRoot,
      runId,
      workspaceDir,
    });
  }

  return runScenarioPlan(normalizedPlan, {
    projectRoot,
    runId,
    workspaceDir,
  });
}

module.exports = {
  PlanRunError,
  createPlanRunError,
  loadPlanCommands,
  runPlan,
};
