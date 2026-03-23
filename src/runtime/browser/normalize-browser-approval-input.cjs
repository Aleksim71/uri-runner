// path: src/runtime/browser/normalize-browser-approval-input.cjs

'use strict';

const FORBIDDEN_ARTIFACTS = new Set([
  'cookies',
  'localStorage',
  'sessionStorage',
  'indexedDb',
  'requestBody',
  'responseBody',
  'authHeaders',
  'userProfile',
  'arbitraryJs',
]);

const CONFIRM_ACTIONS = new Set([
  'open-browser',
  'reload-page',
  'open-url',
  'browser-launch',
  'trace',
]);

function normalizeRequestedArtifacts(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item) => typeof item === 'string' && item.trim())
    .map((item) => item.trim());
}

function normalizeBrowserApprovalInput(input = {}) {
  const goal = typeof input.goal === 'string' && input.goal.trim() ? input.goal.trim() : 'browser-diagnostics';
  const action = typeof input.action === 'string' && input.action.trim() ? input.action.trim() : 'attach';
  const requestedArtifacts = normalizeRequestedArtifacts(input.requestedArtifacts);
  const targetHint = input.targetHint && typeof input.targetHint === 'object' ? input.targetHint : {};
  const reasons = [];

  let policyHint = 'safe';

  if (CONFIRM_ACTIONS.has(action)) {
    policyHint = 'confirm';
    reasons.push('Action class requires explicit confirmation in browser diagnostics v1.');
  }

  const forbiddenRequested = requestedArtifacts.filter((artifact) => FORBIDDEN_ARTIFACTS.has(artifact));
  if (forbiddenRequested.length > 0) {
    policyHint = 'forbidden';
    reasons.push(`Requested artifacts are forbidden in safe browser mode: ${forbiddenRequested.join(', ')}.`);
  }

  if (typeof input.modeHint === 'string' && input.modeHint.trim()) {
    const modeHint = input.modeHint.trim().toLowerCase();
    if (modeHint === 'confirm' && policyHint === 'safe') {
      policyHint = 'confirm';
      reasons.push('Input explicitly requested confirm mode.');
    }
    if (modeHint === 'forbidden') {
      policyHint = 'forbidden';
      reasons.push('Input explicitly requested forbidden mode.');
    }
  }

  return {
    goal,
    action,
    requestedArtifacts,
    targetHint,
    policyHint,
    reasons,
  };
}

module.exports = {
  normalizeBrowserApprovalInput,
};
