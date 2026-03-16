'use strict';

const {
  listTraceHistory
} = require('../../runtime/list-trace-history.cjs');

async function runLastCommand() {
  try {
    const runs = await listTraceHistory();
    const run = runs[0];

    console.log('');
    console.log('URI LAST');
    console.log('────────────────────────');

    if (!run) {
      console.log('No executions found');
      console.log('');

      return { status: 'success', found: false };
    }

    console.log(`runId: ${run.runId}`);

    if (run.createdAt) {
      console.log(`createdAt: ${run.createdAt}`);
    }

    if (run.goal) {
      console.log(`goal: ${run.goal}`);
    }

    console.log(`finalStatus: ${run.finalStatus}`);
    console.log(`attempts: ${run.attempts}`);
    console.log(`stepCount: ${run.steps}`);

    if (run.traceRelPath) {
      console.log(`trace: ${run.traceRelPath}`);
    }

    console.log('');

    return {
      status: 'success',
      found: true,
      runId: run.runId
    };
  } catch (error) {
    console.error('');
    console.error('URI LAST ERROR');
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
  runLastCommand
};
