// path: src/uram/watch/intake-decision.cjs
'use strict';

const { getFileFingerprint } = require('./file-fingerprint.cjs');
const { DedupeCache } = require('./dedupe-cache.cjs');

const dedupe = new DedupeCache();

/**
 * Handle inbox decision with terminal behavior + dedupe.
 *
 * For ignored inboxes, the file must stay in place.
 * We only log once for the same unchanged file and then silently skip it
 * until the fingerprint changes.
 *
 * @param {Object} args
 * @param {string} args.sourceFile absolute path to inbox.zip
 * @param {string} args.decision 'accepted' | 'ignored'
 * @param {string} args.reason optional reason (e.g., 'foreign_receiver')
 * @param {Function} args.log function(line: string)
 * @returns {Object} { action: string }
 */
function handleIntakeDecision({ sourceFile, decision, reason, log }) {
  const fp = getFileFingerprint(sourceFile);

  if (dedupe.isDuplicate(fp)) {
    return { action: 'dedupe_skip' };
  }

  dedupe.remember(fp);

  if (decision === 'ignored') {
    if (log) {
      log('status: ignored');
      if (reason) log('reason: ' + reason);
    }

    return { action: 'ignored_once' };
  }

  return { action: 'pass' };
}

module.exports = { handleIntakeDecision };
