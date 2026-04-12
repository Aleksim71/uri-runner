// path: scripts/demo-terminal-ui.cjs
'use strict';

const { createTerminalRenderer } = require('../src/ui/terminal-render.cjs');

function getArgValue(argv, name, fallback = null) {
  const prefix = `--${name}=`;
  for (const arg of argv.slice(2)) {
    if (arg.startsWith(prefix)) {
      return arg.slice(prefix.length);
    }
  }
  return fallback;
}

const renderer = createTerminalRenderer({
  cliTheme: getArgValue(process.argv, 'theme', null),
  cliPreset: getArgValue(process.argv, 'preset', null),
  noColor: process.argv.includes('--no-color')
});

console.log(renderer.header('URI WATCH', [
  ['theme', renderer.theme.mode],
  ['preset', renderer.theme.preset],
  ['status', 'started'],
  ['transport', 'project-owned'],
  ['config', renderer.theme.configPath || '<none>']
]));

console.log(renderer.section('PIPELINE'));
console.log(renderer.step('intake', 'inbox.zip detected', 'warn'));
console.log(renderer.step('compile', 'scenario compiled', 'success'));
console.log(renderer.step('execute', 'steps completed', 'success'));
console.log(renderer.step('finalize', 'outbox created', 'accent'));

console.log(renderer.section('ARTIFACTS'));
console.log(renderer.path('outbox', '/home/aleksim/workspace/projects/uri-runner/Outbox/outbox.zip'));
console.log(renderer.path('report', '/home/aleksim/workspace/projects/uri-runner/Outbox/REPORT/outbox.json'));
