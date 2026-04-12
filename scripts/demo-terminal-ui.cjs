// path: scripts/demo-terminal-ui.cjs
'use strict';

const { createWatchTerminalUi } = require('../src/ui/watch-terminal-ui.cjs');

function getArgValue(argv, name, fallback = null) {
  const prefix = `--${name}=`;
  for (const arg of argv.slice(2)) {
    if (arg.startsWith(prefix)) {
      return arg.slice(prefix.length);
    }
  }
  return fallback;
}

const ui = createWatchTerminalUi({
  theme: getArgValue(process.argv, 'theme', null),
  noColor: process.argv.includes('--no-color')
});

ui.printBanner([
  ['theme', ui.renderer.theme.mode],
  ['preset', ui.renderer.theme.preset],
  ['transport', 'project-owned'],
  ['config', ui.renderer.theme.configPath || '<none>']
]);

ui.printLegacyStatus('started');
ui.printLegacyStatus('inbox.zip detected');
ui.printLegacyStatus('accepted');
ui.printArtifact('source', '/home/aleksim/Загрузки');
ui.printArtifact('inbox', '/home/aleksim/uri-runner-next/intake/Inbox');
ui.printArtifact('processed', '/home/aleksim/uri-runner-next/runtime/watch/processed');
ui.printStatus('project', 'tempasi', 'accent');
ui.printArtifact('archivedSource', '/home/aleksim/uri-runner-next/intake/source-processed/inbox.2026-04-12T12-00-00-000Z.zip');
ui.printLegacyStatus('execution started');
ui.printLegacyStatus('execution completed');
ui.printLegacyStatus('completed');
ui.printArtifact('outbox', '/home/aleksim/workspace/projects/tempasi/Outbox/outbox.zip');
ui.printArtifact('outboxJson', '/home/aleksim/workspace/projects/tempasi/Outbox/outbox.json');
ui.printSummary({
  result: 'success',
  steps: 4,
  totalSteps: 4,
  checks: 3,
  totalChecks: 3
});
