// path: src/uram/watch/dedupe-cache.cjs
'use strict';

const { isSameFingerprint } = require('./file-fingerprint.cjs');

class DedupeCache {
  constructor() {
    this.lastSeen = null;
  }

  isDuplicate(fp) {
    if (!this.lastSeen) return false;
    return isSameFingerprint(this.lastSeen, fp);
  }

  remember(fp) {
    this.lastSeen = fp;
  }
}

module.exports = { DedupeCache };
