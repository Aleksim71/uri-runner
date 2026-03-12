#!/usr/bin/env node
"use strict";

const path = require("path");
const os = require("os");

const { runUramPipeline } = require("./uram/pipeline.cjs");

const { debugPlan } = require("./cli/commands/debug-plan.cjs");
const { debugRunbook } = require("./cli/commands/debug-runbook.cjs");
const { debugCommands } = require("./cli/commands/debug-commands.cjs");
const { compileInboxToPlan } = require("./cli/commands/compile.cjs");
const { runPlanFile } = require("./cli/commands/run-plan.cjs");

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
  console.error("  uri compile <inbox.zip> <plan.json>");
  console.error("  uri run-plan <plan.json>");
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
  uri compile
  --------------------------------
  */

  if (cmd === "compile") {
    const inboxZip = args[1];
    const outputPlan = args[2];

    if (!inboxZip || !outputPlan) {
      console.error("usage: uri compile <inbox.zip> <plan.json>");
      process.exit(1);
    }

    await compileInboxToPlan({
      uramRoot,
      inboxZipPath: path.resolve(inboxZip),
      outputPlanPath: path.resolve(outputPlan),
    });

    return;
  }

  /*
  --------------------------------
  uri run-plan
  --------------------------------
  */

  if (cmd === "run-plan") {
    const planFile = args[1];

    if (!planFile) {
      console.error("usage: uri run-plan <plan.json>");
      process.exit(1);
    }

    const workspace = process.env.URI_WORKSPACE || null;

    const result = await runPlanFile({
      uramRoot,
      planFilePath: path.resolve(planFile),
      workspaceDir: workspace,
    });

    if (!result || result.exitCode !== 0) {
      process.exit((result && result.exitCode) || 1);
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
