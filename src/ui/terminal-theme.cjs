// path: src/ui/terminal-theme.cjs
'use strict';

const { ANSI, buildPalette } = require('./terminal-palettes.cjs');
const { loadTerminalUiConfig } = require('./load-terminal-ui-config.cjs');
const { resolveTerminalTheme } = require('./resolve-terminal-theme.cjs');

function normalizeBooleanLike(value) {
  if (value === true || value === false) return value;
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return null;
}

function createTerminalTheme(options = {}) {
  const env = options.env || process.env;
  const loaded = loadTerminalUiConfig({
    cwd: options.cwd,
    configPath: options.configPath
  });

  const configUi = loaded.terminalUi || {};

  const theme = resolveTerminalTheme({
    cliTheme: options.cliTheme,
    envTheme: env.URI_TERM_THEME || env.URI_THEME || env.TERMINAL_THEME,
    configTheme: configUi.theme,
    env
  });

  const preset =
    options.cliPreset ||
    env.URI_TERM_PRESET ||
    env.URI_PRESET ||
    configUi.preset;

  const paletteOverride = {
    ...(configUi.palette && typeof configUi.palette === 'object' ? configUi.palette : {}),
    ...(options.palette && typeof options.palette === 'object' ? options.palette : {})
  };

  const noColorFromEnv = normalizeBooleanLike(env.URI_NO_COLOR) ?? normalizeBooleanLike(env.NO_COLOR);
  const noColorFromConfig = normalizeBooleanLike(configUi.noColor);
  const noColor =
    options.noColor === true ||
    noColorFromEnv === true ||
    noColorFromConfig === true ||
    !process.stdout.isTTY;

  const { presetName, palette } = buildPalette({
    theme,
    preset,
    paletteOverride
  });

  function paint(code, text) {
    const value = String(text ?? '');
    if (noColor) return value;
    return `${code}${value}${ANSI.reset}`;
  }

  return {
    mode: theme,
    preset: presetName,
    noColor,
    configPath: loaded.configPath,

    title(text) {
      return paint(`${ANSI.bold}${palette.title}`, text);
    },

    section(text) {
      return paint(`${ANSI.bold}${palette.section}`, text);
    },

    success(text) {
      return paint(palette.success, text);
    },

    warn(text) {
      return paint(palette.warn, text);
    },

    error(text) {
      return paint(`${ANSI.bold}${palette.error}`, text);
    },

    accent(text) {
      return paint(palette.accent, text);
    },

    meta(text) {
      return paint(`${ANSI.dim}${palette.meta}`, text);
    },

    text(text) {
      return paint(palette.normal, text);
    },

    bold(text) {
      return paint(ANSI.bold, text);
    },

    dim(text) {
      return paint(ANSI.dim, text);
    }
  };
}

module.exports = {
  createTerminalTheme,
  normalizeBooleanLike
};
