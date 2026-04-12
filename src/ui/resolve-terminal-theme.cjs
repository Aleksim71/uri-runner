// path: src/ui/resolve-terminal-theme.cjs
'use strict';

function normalizeTheme(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return normalized === 'dark' || normalized === 'light' || normalized === 'auto'
    ? normalized
    : null;
}

function detectBackgroundFromColorFgbg(value) {
  if (typeof value !== 'string' || !value.includes(';')) {
    return null;
  }

  const parts = value
    .split(';')
    .map((item) => Number(String(item).trim()))
    .filter((item) => Number.isFinite(item));

  if (parts.length === 0) {
    return null;
  }

  const bg = parts[parts.length - 1];

  if (bg >= 0 && bg <= 6) return 'dark';
  if (bg >= 7) return 'light';
  return null;
}

function detectAutoTheme(env = process.env) {
  const byColorFgbg = detectBackgroundFromColorFgbg(env.COLORFGBG);
  if (byColorFgbg) return byColorFgbg;

  if (String(env.WT_SESSION || '').trim()) {
    return 'dark';
  }

  const termProgram = String(env.TERM_PROGRAM || '').toLowerCase();
  if (termProgram.includes('vscode')) return 'dark';
  if (termProgram.includes('apple_terminal')) return 'dark';

  return 'dark';
}

function resolveTerminalTheme({ cliTheme, envTheme, configTheme, env = process.env } = {}) {
  const direct =
    normalizeTheme(cliTheme) ||
    normalizeTheme(envTheme) ||
    normalizeTheme(configTheme) ||
    'auto';

  if (direct === 'dark' || direct === 'light') {
    return direct;
  }

  return detectAutoTheme(env);
}

module.exports = {
  normalizeTheme,
  detectBackgroundFromColorFgbg,
  detectAutoTheme,
  resolveTerminalTheme
};
