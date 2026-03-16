'use strict';

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

  if (!command) {
    printHelp();
    return;
  }

  if (command === 'compile') {
    const {
      compileInboxToPlan
    } = require('./commands/compile.cjs');

    const inboxZipPath = commandArgs[0];
    const outputPlanPath = commandArgs[1];

    if (!inboxZipPath || !outputPlanPath) {
      throw new Error('compile requires <inbox.zip> <output-plan.json>');
    }

    return compileInboxToPlan({
      uramRoot: process.cwd(),
      inboxZipPath,
      outputPlanPath
    });
  }

  if (command === 'history') {
    const {
      runHistoryCommand
    } = require('./commands/history.cjs');

    return runHistoryCommand(commandArgs);
  }

  if (command === 'last') {
    const {
      runLastCommand
    } = require('./commands/last.cjs');

    return runLastCommand(commandArgs);
  }

  if (command === 'show') {
    const {
      runShowCommand
    } = require('./commands/show.cjs');

    const runId = commandArgs[0];

    return runShowCommand(runId);
  }

  if (command === 'replay') {
    const {
      runReplayCommand
    } = require('./commands/replay.cjs');

    return runReplayCommand(commandArgs);
  }

  if (command === 'run-plan') {
    const {
      runPlanFile
    } = require('./commands/run-plan.cjs');

    const planFilePath = commandArgs[0];

    if (!planFilePath) {
      throw new Error('run-plan requires <plan-file>');
    }

    return runPlanFile({
      uramRoot: process.cwd(),
      planFilePath
    });
  }

  throw new Error(`Unknown command: ${command}`);
}

function printHelp() {
  console.log('');
  console.log('URI CLI');
  console.log('────────────────────────');
  console.log('Available commands:');
  console.log('  compile <inbox.zip> <output-plan.json>');
  console.log('  history');
  console.log('  last');
  console.log('  show <runId>');
  console.log('  replay <trace-file>');
  console.log('  run-plan <plan-file>');
  console.log('');
}

module.exports = {
  main
};
