'use strict';

const {
  listTraceHistory
} = require('../../runtime/list-trace-history.cjs');

const {
  runHistoryPruneCommand
} = require('./history-prune.cjs');

/**
 * URI CLI
 * history command
 *
 * Usage:
 *   uri history
 *   uri history prune --dry-run
 *   uri history prune
 */

async function runHistoryCommand(args = []) {
  const input = Array.isArray(args) ? args.slice(0) : [];
  const subcommand = input[0];

  if (!subcommand) {
    return printHistoryList();
  }

  if (subcommand === 'prune') {
    return runHistoryPruneCommand(input.slice(1));
  }

  throw new Error(`Unknown history command: ${subcommand}`);
}

async function printHistoryList() {
  try {
    const runs = await listTraceHistory();

    if (!runs.length) {
      console.log('');
      console.log('URI HISTORY');
      console.log('────────────────────────');
      console.log('No executions found');
      console.log('');

      return { status: 'success' };
    }

    console.log('');
    console.log('URI HISTORY');
    console.log('────────────────────────');

    for (const run of runs) {
      console.log('');

      if (run.createdAt) {
        console.log(run.createdAt);
      }

      console.log(run.runId);

      if (run.goal) {
        console.log(`  Goal: ${run.goal}`);
      }

      console.log(`  Status: ${String(run.finalStatus).toUpperCase()}`);
      console.log(`  Steps: ${run.steps}`);
      console.log(`  Attempts: ${run.attempts}`);

      if (run.traceRelPath) {
        console.log(`  Trace: ${run.traceRelPath}`);
      }
    }

    console.log('');

    return {
      status: 'success',
      runs: runs.length
    };
  } catch (error) {
    console.error('');
    console.error('URI HISTORY ERROR');
    console.error('────────────────────────');
    console.error(error.message);
    console.error('');

    return {
      status: 'error',
      error: error.message
    };
  }
}

module.exports = {
  runHistoryCommand
};
