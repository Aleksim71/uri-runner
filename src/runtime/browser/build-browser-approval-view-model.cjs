// path: src/runtime/browser/build-browser-approval-view-model.cjs

'use strict';

function buildRisk(policyHint) {
  switch (policyHint) {
    case 'forbidden':
      return 'high';
    case 'confirm':
      return 'medium';
    default:
      return 'low';
  }
}

function buildWhy(normalizedInput) {
  const { action, requestedArtifacts = [], reasons = [] } = normalizedInput;

  if (reasons.length > 0) {
    return reasons.join(' ');
  }

  if (action === 'attach') {
    return 'Нужно подключиться к разрешённой diagnostic session браузера.';
  }

  if (requestedArtifacts.length > 0) {
    return `Нужно собрать browser artifacts: ${requestedArtifacts.join(', ')}.`;
  }

  return 'Нужно выполнить browser diagnostics действие.';
}

function buildExpectedResult(normalizedInput) {
  const { policyHint, action, requestedArtifacts = [] } = normalizedInput;

  if (policyHint === 'forbidden') {
    return 'Действие не должно быть выполнено в A19.1 safe browser mode.';
  }

  if (action === 'attach') {
    return 'URI подключится к диагностической сессии и сможет собрать безопасные browser artifacts.';
  }

  if (requestedArtifacts.length > 0) {
    return `URI соберёт артефакты: ${requestedArtifacts.join(', ')}.`;
  }

  return 'URI выполнит браузерную диагностику в пределах разрешённого scope.';
}

function buildBrowserApprovalViewModel(normalizedInput = {}) {
  const action = normalizedInput.action || 'attach';
  const requestedArtifacts = Array.isArray(normalizedInput.requestedArtifacts)
    ? normalizedInput.requestedArtifacts
    : [];
  const policyHint = normalizedInput.policyHint || 'safe';

  return {
    title: 'Browser diagnostics approval',
    goal: normalizedInput.goal || 'browser-diagnostics',
    action,
    risk: buildRisk(policyHint),
    why: buildWhy(normalizedInput),
    commands: [
      `browser:${action}`,
      ...(requestedArtifacts.length > 0 ? [`artifacts:${requestedArtifacts.join(',')}`] : []),
    ],
    expectedResult: buildExpectedResult(normalizedInput),
  };
}

module.exports = {
  buildBrowserApprovalViewModel,
};
