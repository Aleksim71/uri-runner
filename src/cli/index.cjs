/* path: src/cli/index.cjs */
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

  if (command === "whoami") {
    const { runWhoAmICommand } = require("./commands/whoami.cjs");
    return runWhoAmICommand();
  }

  if (command === "handoff") {
    const { runHandoffCommand } = require("./commands/handoff.cjs");
    return runHandoffCommand(commandArgs);
  }

  if (command === "piligrim") {
    const subcommand = commandArgs[0];

    if (subcommand === "mark-updated") {
      const { runPiligrimMarkUpdatedCommand } = require("./commands/piligrim-mark-updated.cjs");
      return runPiligrimMarkUpdatedCommand();
    }

    throw new Error(`Unknown piligrim command: ${subcommand}`);
  }

  if (command === "watch") {
    const { runWatchCommand } = require("./commands/watch.cjs");
    return runWatchCommand(commandArgs);
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

    if (subcommand === "step") {
      const { debugStepCommand } = require("./commands/debug-step.cjs");
      return debugStepCommand(...subArgs);
    }

    throw new Error(`Unknown debug command: ${subcommand}`);
  }

  if (command === "browser") {
    const { runBrowserCommand } = require("../commands/browser.cjs");
    const options = parseBrowserArgs(commandArgs);
    return runBrowserCommand(options);
  }

  throw new Error(`Unknown command: ${command}`);
}

function parseBrowserArgs(args = []) {
  const options = {
    host: "127.0.0.1",
    port: "9222",
    artifactsDir: "runtime/browser/artifacts",
    timeoutMs: "10000",
    json: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--host") {
      index += 1;
      if (index >= args.length) throw new Error("browser option --host requires <host>");
      options.host = args[index];
      continue;
    }

    if (arg === "--port") {
      index += 1;
      if (index >= args.length) throw new Error("browser option --port requires <port>");
      options.port = args[index];
      continue;
    }

    if (arg === "--target") {
      index += 1;
      if (index >= args.length) throw new Error("browser option --target requires <matcher>");
      options.target = args[index];
      continue;
    }

    if (arg === "--artifacts-dir") {
      index += 1;
      if (index >= args.length) throw new Error("browser option --artifacts-dir requires <path>");
      options.artifactsDir = args[index];
      continue;
    }

    if (arg === "--timeout-ms") {
      index += 1;
      if (index >= args.length) throw new Error("browser option --timeout-ms requires <ms>");
      options.timeoutMs = args[index];
      continue;
    }

    if (arg === "--json") {
      options.json = true;
      continue;
    }

    throw new Error(`Unknown browser option: ${arg}`);
  }

  return options;
}

function printHelp() {
  console.log("\nURI CLI\n────────────────────────\nAvailable commands:");
  console.log("  browser [--host <host>] [--port <port>] [--target <matcher>] [--artifacts-dir <path>] [--timeout-ms <ms>] [--json]");
  console.log('  debug step <browser.step> [--input \'{"url":"https://example.com"}\']');
  console.log("  compile <inbox.zip> <output-plan.json>");
  console.log("  debug commands <inbox.zip>");
  console.log("  debug plan <inbox.zip>");
  console.log("  debug runbook <inbox.zip>");
  console.log("  handoff [project]");
  console.log("  history");
  console.log("  last");
  console.log("  piligrim mark-updated");
  console.log("  show <runId>");
  console.log("  replay <trace-file|runId> [project]");
  console.log("  run-plan <plan-file>");
  console.log("  runtime gc");
  console.log("  watch");
  console.log("  whoami");
  console.log("");
}

module.exports = { main };

if (require.main === module) {
  main().catch((error) => {
    console.error(error?.stack || error?.message || String(error));
    process.exitCode = 1;
  });
}
