#!/usr/bin/env node
'use strict';

const { runVitest } = require('../../commands/test/run-vitest.cjs');

const WATCHER_TEST_ARGS = [
  'test/scenarios/watch-inbox.accepts-broken-meta.test.mjs',
  'test/scenarios/watch-inbox.accepts-valid-meta.test.mjs',
  'test/scenarios/watch-inbox.strict-intake.test.mjs',
  'test/scenarios/watch-log.creates-on-empty-run.test.mjs',
  'test/scenarios/watch-log.logs-ignore-reason.test.mjs',
  'test/scenarios/watch-log.logs-accept-and-staging.test.mjs',
  'test/scenarios/last-run.created-on-empty-run.test.mjs',
  'test/scenarios/last-run.updated-on-second-run.test.mjs',
  'test/scenarios/last-run.exists-after-accepted-inbox.test.mjs'
];

function registerTestCommand(program) {
  program
    .command('test')
    .description('Run contract and scenario test suites')
    .argument('<target>', 'test target, for example: watcher')
    .action(async (target) => {
      try {
        if (target === 'watcher') {
          const exitCode = await runVitest({ args: WATCHER_TEST_ARGS });
          process.exitCode = exitCode;
          return;
        }

        console.error(`[uri] Unknown test target: ${target}`);
        console.error('[uri] Available targets: watcher');
        process.exitCode = 1;
      } catch (error) {
        console.error(`[uri] Failed to run test target "${target}": ${error.message}`);
        process.exitCode = 1;
      }
    });
}

module.exports = {
  registerTestCommand,
  WATCHER_TEST_ARGS,
};
