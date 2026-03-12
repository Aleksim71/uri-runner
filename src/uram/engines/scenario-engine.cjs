"use strict";

const path = require("path");
const { ERROR_CODES } = require("../error-codes.cjs");

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

function ensureScenarioEngineAllowed(executableCtx) {
  const engine = executableCtx && executableCtx.engine;

  if (engine !== "scenario") {
    throw createScenarioPolicyError(
      ERROR_CODES.ENGINE_NOT_ALLOWED,
      `Engine not allowed: ${String(engine || "") || "unknown"}`,
      {
        engine,
        expected: "scenario",
      }
    );
  }
}

function ensureScenarioSteps(runbook) {
  const steps = runbook && runbook.steps;

  if (!Array.isArray(steps) || steps.length === 0) {
    throw createScenarioPolicyError(
      ERROR_CODES.SCENARIO_INVALID,
      "Scenario runbook is invalid: steps must be a non-empty array",
      {
        field: "steps",
      }
    );
  }

  return steps;
}

function ensureMaxStepsAllowed(steps, executableCtx) {
  const maxSteps =
    executableCtx &&
    executableCtx.runtime &&
    Number.isFinite(executableCtx.runtime.max_steps)
      ? executableCtx.runtime.max_steps
      : null;

  if (maxSteps !== null && steps.length > maxSteps) {
    throw createScenarioPolicyError(
      ERROR_CODES.MAX_STEPS_EXCEEDED,
      `Scenario max steps exceeded: ${steps.length} > ${maxSteps}`,
      {
        maxSteps,
        actualSteps: steps.length,
      }
    );
  }
}

function ensureCommandRootAllowed(commandName, executableCtx) {
  const roots =
    executableCtx &&
    executableCtx.commands &&
    Array.isArray(executableCtx.commands.roots)
      ? executableCtx.commands.roots
      : [];

  const commandRoot = getCommandRoot(commandName);

  if (!commandRoot) {
    throw createScenarioPolicyError(
      ERROR_CODES.SCENARIO_INVALID,
      "Scenario step is invalid: command is missing",
      {
        command: commandName,
      }
    );
  }

  if (!roots.includes(commandRoot)) {
    throw createScenarioPolicyError(
      ERROR_CODES.COMMAND_ROOT_NOT_ALLOWED,
      `Command root not allowed: ${commandRoot}`,
      {
        command: commandName,
        commandRoot,
        allowedRoots: roots,
      }
    );
  }
}

function ensureCommandAllowed(commandName, loadedCommands, executableCtx) {
  const strictCommands = Boolean(
    executableCtx &&
      executableCtx.runtime &&
      executableCtx.runtime.strict_commands === true
  );

  if (!strictCommands) {
    return;
  }

  if (!loadedCommands.includes(commandName)) {
    throw createScenarioPolicyError(
      ERROR_CODES.COMMAND_NOT_FOUND,
      `Command not found: ${commandName}`,
      {
        commandNames: [commandName],
      }
    );
  }
}

function normalizeLoadedCommands(commandMap) {
  if (!commandMap || typeof commandMap !== "object") {
    return [];
  }

  return Object.keys(commandMap).sort();
}

function uniquePaths(paths) {
  return [...new Set(paths.filter(Boolean).map((p) => path.resolve(p)))];
}

function getSystemCommandDirs(projectRoot) {
  return uniquePaths([
    path.join(projectRoot, "contexts", "system", "commands"),
    path.join(__dirname, "..", "commands", "system"),
    path.join(__dirname, "..", "..", "commands", "system"),
    path.join(__dirname, "..", "..", "cli", "commands"),
    path.join(__dirname, "..", "..", "..", "commands", "system"),
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

async function loadCommands({ projectRoot, executableCtx }) {
  const commandRoots =
    executableCtx &&
    executableCtx.commands &&
    Array.isArray(executableCtx.commands.roots)
      ? executableCtx.commands.roots
      : [];

  const commands = {};

  for (const root of commandRoots) {
    if (root === "system") {
      const dirs = getSystemCommandDirs(projectRoot);

      for (const dirPath of dirs) {
        await tryLoadCommandDir(dirPath, "system", commands);
      }

      continue;
    }

    if (root === "project") {
      const dirs = getProjectCommandDirs(projectRoot);

      for (const dirPath of dirs) {
        await tryLoadCommandDir(dirPath, "project", commands);
      }

      continue;
    }
  }

  return commands;
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
      throw createScenarioPolicyError(
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

async function executeScenarioStep(step, context) {
  const { commands } = context;
  const commandName = step.command;
  const commandFn = commands[commandName];

  if (typeof commandFn !== "function") {
    throw createScenarioPolicyError(
      ERROR_CODES.COMMAND_NOT_FOUND,
      `Command not found: ${commandName}`,
      {
        commandNames: [commandName],
      }
    );
  }

  return commandFn({
    id: step.id,
    command: commandName,
    args: step.args || {},
    context,
  });
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

  ensureScenarioEngineAllowed(executableCtx);

  const steps = ensureScenarioSteps(runbook);
  ensureMaxStepsAllowed(steps, executableCtx);

  const commands = await loadCommands({
    projectRoot,
    executableCtx,
  });

  const loadedCommands = normalizeLoadedCommands(commands);

  const executionContext = {
    runId,
    workspaceDir,
    projectRoot,
    executableCtx,
    commands,
    loadedCommands,
    results: [],
  };

  for (const step of steps) {
    if (!step || typeof step !== "object") {
      throw createScenarioPolicyError(
        ERROR_CODES.SCENARIO_INVALID,
        "Scenario step is invalid: step must be an object"
      );
    }

    if (typeof step.command !== "string" || step.command.trim().length === 0) {
      throw createScenarioPolicyError(
        ERROR_CODES.SCENARIO_INVALID,
        "Scenario step is invalid: command is missing",
        {
          stepId: step.id || null,
        }
      );
    }

    ensureCommandRootAllowed(step.command, executableCtx);
    ensureCommandAllowed(step.command, loadedCommands, executableCtx);

    const value = await executeScenarioStep(step, executionContext);

    executionContext.results.push({
      stepId: step.id || null,
      command: step.command,
      ok: true,
      value: value === undefined ? null : value,
    });
  }

  return {
    exitCode: 0,
    outboxPayload: {
      ok: true,
      engine: "scenario",
      project,
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
  ScenarioPolicyError,
  createScenarioPolicyError,
  getCommandRoot,
  ensureScenarioEngineAllowed,
  ensureScenarioSteps,
  ensureMaxStepsAllowed,
  ensureCommandRootAllowed,
  ensureCommandAllowed,
  normalizeLoadedCommands,
  loadCommands,
  runScenarioEngine,
};
