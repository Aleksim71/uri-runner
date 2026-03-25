// path: src/uram/policy-hook.cjs

'use strict';

function enforcePolicy(decision) {
  if (decision === 'allow') return;

  if (decision === 'deny') {
    const err = new Error('POLICY_DENIED');
    err.code = 'POLICY_DENIED';
    throw err;
  }

  if (decision === 'ask') {
    const err = new Error('POLICY_APPROVAL_REQUIRED');
    err.code = 'POLICY_APPROVAL_REQUIRED';
    throw err;
  }
}

module.exports = { enforcePolicy };
