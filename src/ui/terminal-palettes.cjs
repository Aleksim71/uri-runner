// path: src/ui/terminal-palettes.cjs
'use strict';

const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',

  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',

  brightBlack: '\x1b[90m',
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m'
};

const PRESETS = {
  'dark-contrast': {
    title: 'brightCyan',
    section: 'brightWhite',
    success: 'brightGreen',
    warn: 'brightYellow',
    error: 'brightRed',
    accent: 'brightMagenta',
    meta: 'brightBlack',
    normal: 'brightWhite'
  },

  'dark-soft': {
    title: 'cyan',
    section: 'white',
    success: 'green',
    warn: 'yellow',
    error: 'red',
    accent: 'magenta',
    meta: 'brightBlack',
    normal: 'white'
  },

  'light-contrast': {
    title: 'blue',
    section: 'black',
    success: 'green',
    warn: 'yellow',
    error: 'red',
    accent: 'magenta',
    meta: 'brightBlack',
    normal: 'black'
  },

  'light-soft': {
    title: 'blue',
    section: 'black',
    success: 'green',
    warn: 'yellow',
    error: 'red',
    accent: 'magenta',
    meta: 'brightBlack',
    normal: 'black'
  },

  universal: {
    title: 'cyan',
    section: 'white',
    success: 'green',
    warn: 'yellow',
    error: 'red',
    accent: 'magenta',
    meta: 'brightBlack',
    normal: 'white'
  }
};

const DEFAULT_PRESET_BY_THEME = {
  dark: 'dark-contrast',
  light: 'light-contrast',
  auto: 'universal'
};

const ALLOWED_COLOR_KEYS = new Set(Object.keys(ANSI).filter((key) => !['reset', 'bold', 'dim'].includes(key)));
const ALLOWED_ROLE_KEYS = new Set(['title', 'section', 'success', 'warn', 'error', 'accent', 'meta', 'normal']);

function normalizeColorToken(value) {
  if (typeof value !== 'string') return null;
  const token = value.trim();
  return ALLOWED_COLOR_KEYS.has(token) ? token : null;
}

function normalizePaletteOverride(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const result = {};
  for (const [key, token] of Object.entries(value)) {
    if (!ALLOWED_ROLE_KEYS.has(key)) continue;
    const normalized = normalizeColorToken(token);
    if (!normalized) continue;
    result[key] = normalized;
  }
  return result;
}

function resolvePresetName({ theme, preset }) {
  if (typeof preset === 'string' && PRESETS[preset]) {
    return preset;
  }

  if (theme === 'dark') return DEFAULT_PRESET_BY_THEME.dark;
  if (theme === 'light') return DEFAULT_PRESET_BY_THEME.light;
  return DEFAULT_PRESET_BY_THEME.auto;
}

function buildPalette({ theme, preset, paletteOverride }) {
  const presetName = resolvePresetName({ theme, preset });
  const base = PRESETS[presetName] || PRESETS[DEFAULT_PRESET_BY_THEME.dark];
  const override = normalizePaletteOverride(paletteOverride);

  const resolved = {};
  for (const role of Object.keys(base)) {
    const token = override[role] || base[role];
    resolved[role] = ANSI[token] || ANSI.white;
  }

  return {
    presetName,
    palette: resolved
  };
}

module.exports = {
  ANSI,
  PRESETS,
  ALLOWED_COLOR_KEYS,
  ALLOWED_ROLE_KEYS,
  normalizeColorToken,
  normalizePaletteOverride,
  resolvePresetName,
  buildPalette
};
