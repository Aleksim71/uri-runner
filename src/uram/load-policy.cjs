// path: src/uram/load-policy.cjs

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('yaml');

function loadPolicy(configDir) {
  const file = path.join(configDir, 'policy.yaml');

  if (!fs.existsSync(file)) {
    throw new Error('Policy file not found: ' + file);
  }

  const raw = fs.readFileSync(file, 'utf-8');
  const data = yaml.parse(raw);

  if (!data || typeof data !== 'object' || !data.profiles) {
    throw new Error('Invalid policy.yaml structure');
  }

  return data;
}

module.exports = { loadPolicy };
