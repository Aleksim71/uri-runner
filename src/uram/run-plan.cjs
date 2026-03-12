"use strict";

const path = require("path");
const { ERROR_CODES } = require("./error-codes.cjs");

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
    path.join(__dirname, "commands", "system"),
    path.join(__dirname, "..", "commands", "system"),
    path.join(__dirname, "..", "cli", "commands"),
    path.join(process.cwd(), "src", "uram", "commands", "system"),
    path.join(process.cwd(), "src", "commands", "system"),
    path.join(process.cwd(), "src", "cli", "commands"),
  ]);
}

function getProjectCommandDirs(projectRoot) {
  return uniquePaths([
    path.join(projectRoot, "contexts", "project", "commands"),
  ]);
}

async function tryLoadCommandDir(dirPath, namespace, target) {
  const fs = require("fs/promises");

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

    try {
      delete require.cache[require.resolve(absolutePath)];
      const mod = require(absolutePath);

      if (typeof mod === "function") {
        target[commandName] = mod;
        continue;
      }

      if (mod && typeof mod.run === "function") {
        target[commandName] = mod.run;
      }
    } catch (error) {
      throw createPlanRunError(
        ERROR_CODES.SCENARIO_INVALID,
        `Failed to load command: ${commandName}`,
        {
          command: commandName,
          path: absolutePath,
          cause: error && error.message ? error.message : String(error),
        }
      );
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

function ensureCommandAvailable(commandName, loadedCommands, strictCommands) {
  if (!strictCommands) {
    return;
  }

  if (!loadedCommands.includes(commandName)) {
    throw createPlanRunError(
      ERROR_CODES.COMMAND_NOT_FOUND,
      `Command not found: ${commandName}`,
      {
        commandNames: [commandName],
      }
    );
  }
}

async function executePlanStep(step, context) {
  const commandFn = context.commands[step.command];

  if (typeof commandFn !== "function") {
    throw createPlanRunError(
      ERROR_CODES.COMMAND_NOT_FOUND,
      `Command not found: ${step.command}`,
      {
        commandNames: [step.command],
      }
    );
  }

  return commandFn({
    id: step.stepId,
    command: step.command,
    args: step.args || {},
    context,
  });
}

async function runPlan(params) {
  const {
    plan,
    projectRoot,
    runId = null,
    workspaceDir = null,
  } = params || {};

  if (!plan || typeof plan !== "object") {
    throw createPlanRunError(
      ERROR_CODES.SCENARIO_INVALID,
      "Plan is invalid: object expected"
    );
  }

  if (plan.kind !== "scenario-plan") {
    throw createPlanRunError(
      ERROR_CODES.SCENARIO_INVALID,
      `Plan is invalid: unsupported kind ${String(plan.kind || "") || "unknown"}`
    );
  }

  const commands = await loadPlanCommands({
    projectRoot,
    executableCtxSnapshot: plan.executableCtxSnapshot || {},
  });

  const loadedCommands = normalizeLoadedCommands(commands);
  const strictCommands = plan.runtime?.strictCommands === true;

  const executionContext = {
    runId,
    workspaceDir,
    projectRoot,
    commands,
    loadedCommands,
    plan,
    results: [],
  };

  for (const step of plan.steps || []) {
    ensureCommandAvailable(step.command, loadedCommands, strictCommands);

    const value = await executePlanStep(step, executionContext);

    executionContext.results.push({
      stepId: step.stepId,
      command: step.command,
      ok: true,
      value: value === undefined ? null : value,
    });
  }

  return {
    exitCode: 0,
    outboxPayload: {
      ok: true,
      engine: plan.engine,
      project: plan.project,
      loaded_commands: loadedCommands,
      result: {
        results: executionContext.results,
      },
    },
    meta: {
      loadedCommands,
    },
  };
}

module.exports = {
  PlanRunError,
  createPlanRunError,
  loadPlanCommands,
  runPlan,
};
