"use strict";

const path = require("path");

const { CommandRegistry } = require("../../commands/command-registry.cjs");
const { loadCommands } = require("../../commands/load-commands.cjs");

const { parseScenario } = require("../scenario-parser.cjs");
const { executeScenario } = require("../scenario-executor.cjs");

function getScenarioCommandNames(runbook) {
  if (!Array.isArray(runbook.steps) || runbook.steps.length === 0) {
    throw new Error("RUNBOOK.yaml: steps must be a non-empty array for scenario execution");
  }

  const names = runbook.steps
    .map((step) => step && step.command)
    .filter((v) => typeof v === "string" && v.trim())
    .map((v) => v.trim());

  return Array.from(new Set(names));
}

function validateCommandRoots(commandNames, executableCtx) {
  const allowedRoots = executableCtx?.commands?.roots || [];

  if (!allowedRoots.length) {
    return;
  }

  for (const name of commandNames) {
    const root = name.split(".")[0];

    if (!allowedRoots.includes(root)) {
      throw new Error(
        `[uri] command root not allowed by executable context: ${name}`
      );
    }
  }
}

function preflightCommands(commandNames, registry, executableCtx) {
  for (const name of commandNames) {
    registry.assertAllowed(name, executableCtx);
  }
}

async function runScenarioEngine({
  runbook,
  projectCtx,
  executableCtx,
  quiet,
}) {
  const commandNames = getScenarioCommandNames(runbook);

  const commandsDir = path.resolve(__dirname, "../../commands");

  validateCommandRoots(commandNames, executableCtx);

  const registry = new CommandRegistry();

  const loaded = loadCommands(commandsDir, registry, {
    only: commandNames,
  });

  preflightCommands(commandNames, registry, executableCtx);

  const parsed = parseScenario(runbook);

  if (!quiet) {
    console.log(`[uri] run: scenario commands loaded=${loaded.length}`);
    console.log(`[uri] run: scenario commands=${commandNames.join(", ")}`);
  }

  const maxSteps =
    executableCtx?.runtime?.maxSteps && Number.isInteger(executableCtx.runtime.maxSteps)
      ? executableCtx.runtime.maxSteps
      : 100;

  const result = await executeScenario(parsed, {
    registry,
    context: {
      cwd: projectCtx.cwd,
      logger: console,
      state: { steps: {} },
    },
    maxSteps,
  });

  const loadedCommands = loaded.map((item) => item.name);

  return {
    exitCode: result.ok ? 0 : 1,
    engine: "scenario",
    outboxPayload: {
      ok: result.ok,
      engine: "scenario",
      project: runbook.meta?.project || runbook.project,
      cwd: projectCtx.cwd,
      loaded_commands: loadedCommands,
      result,
    },
    meta: {
      scenarioRes: result,
      loadedCommands,
    },
  };
}

module.exports = { runScenarioEngine };
