// path: src/runtime/browser/render-browser-approval-prompt.cjs

'use strict';

function renderLines(label, value) {
  return `- ${label}: ${value}`;
}

function renderBrowserApprovalPrompt(viewModel = {}) {
  const commands = Array.isArray(viewModel.commands) ? viewModel.commands : [];
  const lines = [
    'BROWSER DIAGNOSTICS APPROVAL',
    '────────────────────────',
    renderLines('Цель', viewModel.goal || 'browser-diagnostics'),
    renderLines('Действие', viewModel.action || 'attach'),
    renderLines('Почему это нужно', viewModel.why || 'Не указано'),
    renderLines('Риск', viewModel.risk || 'low'),
    renderLines('Ожидаемый результат', viewModel.expectedResult || 'Не указано'),
    renderLines('Команды', commands.length > 0 ? commands.join(' | ') : 'нет'),
  ];

  return `${lines.join('\n')}\n`;
}

module.exports = {
  renderBrowserApprovalPrompt,
};
