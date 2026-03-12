#!/usr/bin/env node
"use strict";

const path = require("path");
const os = require("os");

const { runUramPipeline } = require("./uram/pipeline.cjs");

const { debugPlan } = require("./cli/commands/debug-plan.cjs");
const { debugRunbook } = require("./cli/commands/debug-runbook.cjs");
const { debugCommands } = require("./cli/commands/debug-commands.cjs");

function resolveUramRoot(cliUram) {
  if (cliUram) {
    return path.resolve(cliUram);
  }

  if (process.env.URI_URAM) {
    return path.resolve(process.env.URI_URAM);
  }

  return path.join(os.homedir(), ".uri");
}

function printUsage() {
  console.error("usage:");
  console.error("  uri run");
  console.error("  uri debug plan <inbox.zip>");
  console.error("  uri debug runbook <inbox.zip>");
  console.error("  uri debug commands <inbox.zip>");
}

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];

  const uramRoot = resolveUramRoot(process.env.URI_URAM);

  if (!cmd) {
    printUsage();
    process.exit(1);
  }

  /*
  --------------------------------
  uri run
  --------------------------------
  */

  if (cmd === "run") {
    const workspace = process.env.URI_WORKSPACE;

    const result = await runUramPipeline({
      uramCli: uramRoot,
      workspaceCli: workspace,
      quiet: false,
      env: process.env,
      homeDir: os.homedir(),
    });

    if (!result.ok) {
      process.exit(result.exitCode || 1);
    }

    return;
  }

  /*
  --------------------------------
  uri debug plan
  --------------------------------
  */

  if (cmd === "debug" && args[1] === "plan") {
    const inboxZip = args[2];

    if (!inboxZip) {
      console.error("usage: uri debug plan <inbox.zip>");
      process.exit(1);
    }

    await debugPlan({
      uramRoot,
      inboxZipPath: path.resolve(inboxZip),
    });

    return;
  }

  /*
  --------------------------------
  uri debug runbook
  --------------------------------
  */

  if (cmd === "debug" && args[1] === "runbook") {
    const inboxZip = args[2];

    if (!inboxZip) {
      console.error("usage: uri debug runbook <inbox.zip>");
      process.exit(1);
    }

    await debugRunbook({
      uramRoot,
      inboxZipPath: path.resolve(inboxZip),
    });

    return;
  }

  /*
  --------------------------------
  uri debug commands
  --------------------------------
  */

  if (cmd === "debug" && args[1] === "commands") {
    const inboxZip = args[2];

    if (!inboxZip) {
      console.error("usage: uri debug commands <inbox.zip>");
      process.exit(1);
    }

    await debugCommands({
      uramRoot,
      inboxZipPath: path.resolve(inboxZip),
    });

    return;
  }

  console.error(`unknown command: ${cmd}`);
  printUsage();
  process.exit(1);
}

main().catch((err) => {
  console.error("[uri] fatal error");
  console.error(err);
  process.exit(1);
});
