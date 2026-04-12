// path: src/ui/load-terminal-ui-config.cjs
'use strict';

const fs = require('fs');
const path = require('path');

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function findConfigPath(cwd = process.cwd()) {
  const localPath = path.join(cwd, 'config', 'terminal-ui.json');
  if (fs.existsSync(localPath)) {
    return localPath;
  }
  return null;
}

function loadTerminalUiConfig(options = {}) {
  const cwd = options.cwd || process.cwd();
  const configPath = options.configPath || findConfigPath(cwd);

  if (!configPath) {
    return {
      configPath: null,
      terminalUi: {}
    };
  }

  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw);
    const terminalUi = isObject(parsed?.terminalUi) ? parsed.terminalUi : {};

    return {
      configPath,
      terminalUi
    };
  } catch (error) {
    return {
      configPath,
      terminalUi: {},
      error
    };
  }
}

module.exports = { loadTerminalUiConfig, findConfigPath };
