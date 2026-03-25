// path: src/uram/resolve-command-permission.cjs

'use strict';

function resolveCommandPermission({ policy, profile, root }) {
  const profiles = policy.profiles || {};
  const profileConfig = profiles[profile];

  if (!profileConfig) {
    throw new Error('Unknown policy profile: ' + profile);
  }

  const decision = profileConfig[root];

  if (!decision) {
    return 'deny';
  }

  if (!['allow', 'ask', 'deny'].includes(decision)) {
    throw new Error('Invalid policy decision: ' + decision);
  }

  return decision;
}

module.exports = { resolveCommandPermission };
