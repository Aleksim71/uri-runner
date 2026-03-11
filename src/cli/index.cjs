"use strict";

const path = require("path");
const { registerTestCommand } = require("./commands/test.cjs");
const { runWatchInboxOnce } = require("../uram/watch-inbox-once.cjs");
const { run } = require("../uram/run.cjs");

function printHelp() {
  console.log(`uri - URI Runner Next

Usage:
  uri --help
  uri watch-inbox-once [--root <path>]
  uri test <target>
  uri run [--uram <path>] [--workspace <path>] [--verbose] [--quiet]

Commands:
  watch-inbox-once   Run watcher once against configured folders
  test               Run test targets
  run                Run URAM pipeline against inbox.zip

Options:
  --help             Show this help message
  --root <path>      Override URAM root for watcher
  --uram <path>      Override URAM root for run
  --workspace <path> Override workspace directory for run
  --verbose          Print extra logs
  --quiet            Reduce logs
`);
}

function readArgValue(args, name) {
  const idx = args.indexOf(name);
  if (idx === -1) return null;
  return args[idx + 1] ?? null;
}

function hasFlag(args, name) {
  return args.includes(name);
}

function createProgramShim() {
  return {
    command(name) {
      const commandName = String(name).trim();

      return {
        description() {
          return this;
        },

        argument() {
          return this;
        },

        action(handler) {
          this._handler = handler;
          createProgramShim.handlers.set(commandName, handler);
          return this;
        },
      };
    },
  };
}

createProgramShim.handlers = new Map();

async function main(argv = process.argv.slice(2)) {
  const args = Array.isArray(argv) ? argv : [];

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    printHelp();
    return;
  }

  const program = createProgramShim();
  registerTestCommand(program);

  const command = args[0];

  if (command === "watch-inbox-once") {
    const rootArg = readArgValue(args, "--root");
    const uramRoot = rootArg ? path.resolve(rootArg) : process.cwd();

    await runWatchInboxOnce({ uramRoot });
    return;
  }

  if (command === "run") {
    const uramCli = readArgValue(args, "--uram");
    const workspaceCli = readArgValue(args, "--workspace");
    const verbose = hasFlag(args, "--verbose");
    const quiet = hasFlag(args, "--quiet");

    const result = await run({
      uramCli,
      workspaceCli,
      keepWorkspace: false,
      verbose,
      quiet,
      env: process.env,
      homeDir: process.env.HOME,
    });

    if (result && typeof result.exitCode === "number") {
      process.exitCode = result.exitCode;
    }

    return;
  }

  const registeredHandler = createProgramShim.handlers.get(command);
  if (registeredHandler) {
    const target = args[1];
    await registeredHandler(target);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

module.exports = { main };
