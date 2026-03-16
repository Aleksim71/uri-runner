"use strict";

/**
 * URI CLI
 * Main command router
 *
 * Commands are loaded lazily so one broken command
 * does not break the whole CLI.
 */

async function main(argv = process.argv.slice(2)) {
  const args = Array.isArray(argv) ? argv.slice(0) : [];

  const command = args[0];
  const commandArgs = args.slice(1);

  if (!command || command === "--help" || command === "-h" || command === "help") {
    printHelp();
    return;
  }

  if (command === "compile") {
    const { compileInboxToPlan } = require("./commands/compile.cjs");

    const inboxZipPath = commandArgs[0];
    const outputPlanPath = commandArgs[1];

    if (!inboxZipPath || !outputPlanPath) {
      throw new Error("compile requires <inbox.zip> <output-plan.json>");
    }

    return compileInboxToPlan({
      uramRoot: process.cwd(),
      inboxZipPath,
      outputPlanPath,
    });
  }

  if (command === "history") {
    const { runHistoryCommand } = require("./commands/history.cjs");
    return runHistoryCommand(commandArgs);
  }

  if (command === "last") {
    const { runLastCommand } = require("./commands/last.cjs");
    return runLastCommand(commandArgs);
  }

  if (command === "show") {
    const { runShowCommand } = require("./commands/show.cjs");

    const runId = commandArgs[0];
    if (!runId) {
      throw new Error("show requires <runId>");
    }

    return runShowCommand(runId);
  }

  if (command === "replay") {
    const { runReplayCommand } = require("./commands/replay.cjs");

    const traceOrRunId = commandArgs[0];
    const project = commandArgs[1];

    if (!traceOrRunId) {
      throw new Error("replay requires <trace-file-or-runId> [project]");
    }

    return runReplayCommand([traceOrRunId, project].filter(Boolean));
  }

  if (command === "run-plan") {
    const { runPlanFile } = require("./commands/run-plan.cjs");

    const planFilePath = commandArgs[0];

    if (!planFilePath) {
      throw new Error("run-plan requires <plan-file>");
    }

    return runPlanFile({
      uramRoot: process.cwd(),
      planFilePath,
    });
  }

  if (command === "runtime") {
    const subcommand = commandArgs[0];
    const subArgs = commandArgs.slice(1);

    if (subcommand === "gc") {
      const { runRuntimeGcCommand } = require("./commands/runtime-gc.cjs");
      return runRuntimeGcCommand(subArgs);
    }

    throw new Error(`Unknown runtime command: ${subcommand}`);
  }

  if (command === "debug") {
    const subcommand = commandArgs[0];
    const subArgs = commandArgs.slice(1);

    if (subcommand === "plan") {
      const { debugPlan } = require("./commands/debug-plan.cjs");
      return debugPlan(...subArgs);
    }

    if (subcommand === "commands") {
      const { debugCommands } = require("./commands/debug-commands.cjs");
      return debugCommands(...subArgs);
    }

    if (subcommand === "runbook") {
      const { debugRunbook } = require("./commands/debug-runbook.cjs");
      return debugRunbook(...subArgs);
    }

    throw new Error(`Unknown debug command: ${subcommand}`);
  }

  throw new Error(`Unknown command: ${command}`);
}

function printHelp() {
  console.log("");
  console.log("URI CLI");
  console.log("────────────────────────");
  console.log("Available commands:");
  console.log("  compile <inbox.zip> <output-plan.json>");
  console.log("  debug commands <inbox.zip>");
  console.log("  debug plan <inbox.zip>");
  console.log("  debug runbook <inbox.zip>");
  console.log("  history");
  console.log("  history prune [--dry-run] [project]");
  console.log("  last");
  console.log("  show <runId>");
  console.log("  replay <trace-file|runId> [project]");
  console.log("  run-plan <plan-file>");
  console.log("  runtime gc [--keep-last-runs N] [--dry-run] [project]");
  console.log("");
}

module.exports = {
  main,
};
