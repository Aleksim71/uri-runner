#!/usr/bin/env node
'use strict';

const { spawn } = require('node:child_process');
const path = require('node:path');

function runVitest({ args = [], cwd = process.cwd(), stdio = 'inherit' } = {}) {
  return new Promise((resolve, reject) => {
    const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    const child = spawn(command, ['vitest', 'run', ...args], {
      cwd: path.resolve(cwd),
      env: process.env,
      stdio,
    });

    child.on('error', reject);

    child.on('close', (code, signal) => {
      if (signal) {
        return reject(new Error(`Vitest terminated by signal: ${signal}`));
      }

      resolve(code ?? 1);
    });
  });
}

module.exports = {
  runVitest,
};
