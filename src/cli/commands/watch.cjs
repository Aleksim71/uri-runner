/* path: src/cli/commands/watch.cjs */
"use strict";

const path = require("path");
const { watchInboxOnce, runWatchLoop, defaultConfigPath } = require("../../uram/watch-inbox-once.cjs");

function parseWatchArgs(args = []) {
  const input = Array.isArray(args) ? args.slice(0) : [];

  let once = false;
  let configPath;
  let intervalMs = 2000;

  for (let i = 0; i < input.length; i += 1) {
    const arg = input[i];

    if (arg === "--once") {
      once = true;
      continue;
    }

    if (arg === "--config") {
      const next = input[i + 1];
      if (!next) {
        throw new Error("watch requires a value after --config");
      }
      configPath = next;
      i += 1;
      continue;
    }

    if (arg === "--interval") {
      const raw = input[i + 1];
      i += 1;

      if (!raw) {
        throw new Error("watch requires a value after --interval");
      }

      const parsed = Number(raw);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error("watch requires --interval to be a positive number");
      }

      intervalMs = Math.floor(parsed);
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      printWatchHelp();
      return {
        helpOnly: true,
      };
    }

    throw new Error(`Unknown watch option: ${arg}`);
  }

  return {
    helpOnly: false,
    once,
    configPath: configPath ? path.resolve(configPath) : undefined,
    intervalMs,
  };
}

function printWatchHelp() {
  console.log("");
  console.log("URI WATCH");
  console.log("────────────────────────");
  console.log("Usage:");
  console.log("  uri watch --once [--config <file>]");
  console.log("  uri watch [--config <file>] [--interval <ms>]");
  console.log("");
  console.log(`Default config: ${defaultConfigPath()}`);
  console.log("");
}

function applyExitCode(result) {
  if (!result || typeof result !== "object") {
    process.exitCode = 1;
    return;
  }

  if (result.status === "config_error") {
    process.exitCode = 2;
    return;
  }

  if (result.status === "failed") {
    process.exitCode = 1;
    return;
  }

  process.exitCode = 0;
}

async function runWatchCommand(args = []) {
  const options = parseWatchArgs(args);

  if (options.helpOnly) {
    return {
      ok: true,
      status: "help",
    };
  }

  const runnerOptions = {
    configPath: options.configPath,
    stdout: process.stdout,
  };

  let result;

  if (options.once) {
    result = await watchInboxOnce({
      ...runnerOptions,
      mode: "once",
      executeFullCycle: true,
      archiveSource: true,
    });
  } else {
    result = await runWatchLoop({
      ...runnerOptions,
      intervalMs: options.intervalMs,
    });
  }

  applyExitCode(result);
  return result;
}

module.exports = {
  runWatchCommand,
  parseWatchArgs,
  printWatchHelp,
};
