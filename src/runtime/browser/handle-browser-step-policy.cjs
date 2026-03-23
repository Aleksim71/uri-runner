// path: src/runtime/browser/handle-browser-step-policy.cjs

'use strict';

const SAFE_ACTIONS = new Set(['attach', 'collect']);
const CONFIRM_ACTIONS = new Set(['reload-page', 'open-url', 'open-browser', 'browser-launch', 'trace']);
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

function handleBrowserStepPolicy(normalizedInput = {}) {
  const action = normalizedInput.action || 'attach';
  const requestedArtifacts = Array.isArray(normalizedInput.requestedArtifacts)
    ? normalizedInput.requestedArtifacts
    : [];
  const policyHint = normalizedInput.policyHint || 'safe';

  const forbiddenArtifact = requestedArtifacts.find((artifact) => FORBIDDEN_ARTIFACTS.has(artifact));
  if (policyHint === 'forbidden' || forbiddenArtifact) {
    return {
      decision: 'deny',
      reasonCode: 'forbidden_browser_scope',
      reasonText: forbiddenArtifact
        ? `Artifact "${forbiddenArtifact}" is forbidden in A19.1 safe browser mode.`
        : 'Requested browser action is forbidden in A19.1 safe browser mode.',
    };
  }

  if (policyHint === 'confirm' || CONFIRM_ACTIONS.has(action)) {
    return {
      decision: 'confirm',
      reasonCode: 'browser_confirm_required',
      reasonText: 'This browser action requires explicit user confirmation.',
    };
  }

  if (SAFE_ACTIONS.has(action)) {
    return {
      decision: 'allow',
      reasonCode: 'browser_safe_action',
      reasonText: 'This browser action is allowed in safe diagnostics mode.',
    };
  }

  return {
    decision: 'confirm',
    reasonCode: 'browser_unknown_action',
    reasonText: 'Unknown browser action defaults to confirm on A19.1.',
  };
}

module.exports = {
  handleBrowserStepPolicy,
};
