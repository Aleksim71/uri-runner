// path: src/ui/terminal-render.cjs
'use strict';

const { createTerminalTheme } = require('./terminal-theme.cjs');

function line(width = 56) {
  return '─'.repeat(width);
}

function createTerminalRenderer(options = {}) {
  const theme = createTerminalTheme(options);

  function header(title, meta = []) {
    const rows = [
      theme.title(title),
      theme.meta(line())
    ];

    for (const [key, value] of meta) {
      rows.push(`${theme.meta(`${key}:`)} ${theme.text(value)}`);
    }

    return rows.join('\n');
  }

  function section(title) {
    return `\n${theme.section(title)}`;
  }

  function step(label, status, state = 'info') {
    let marker = theme.text('•');
    let text = theme.text(status);

    if (state === 'success') {
      marker = theme.success('✓');
      text = theme.success(status);
    } else if (state === 'error') {
      marker = theme.error('✗');
      text = theme.error(status);
    } else if (state === 'warn') {
      marker = theme.warn('◌');
      text = theme.warn(status);
    } else if (state === 'accent') {
      marker = theme.accent('◆');
      text = theme.accent(status);
    }

    return `  ${marker} ${String(label).padEnd(14)} ${text}`;
  }

  function path(label, value) {
    return `  ${theme.meta(`${label}:`)} ${theme.accent(value)}`;
  }

  return {
    theme,
    header,
    section,
    step,
    path
  };
}

module.exports = { createTerminalRenderer };
