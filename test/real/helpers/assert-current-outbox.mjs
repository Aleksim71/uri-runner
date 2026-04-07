// path: test/real/helpers/assert-current-outbox.mjs
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

async function loadExpected(expectedOrPath) {
  if (typeof expectedOrPath === 'string') {
    const raw = await fs.readFile(expectedOrPath, 'utf8');
    return JSON.parse(raw);
  }

  if (expectedOrPath && typeof expectedOrPath === 'object') {
    return expectedOrPath;
  }

  throw new TypeError('assertCurrentOutbox expected a parsed object or a path string.');
}

export async function assertCurrentOutbox(actual, expectedOrPath) {
  const expected = await loadExpected(expectedOrPath);

  assert.ok(actual && typeof actual === 'object', 'actual outbox must be an object');

  if ('status' in expected) {
    assert.equal(actual.status, expected.status, 'status mismatch');
  }

  if ('attempts' in expected) {
    assert.equal(actual.attempts, expected.attempts, 'attempts mismatch');
  }

  if ('stopReason' in expected) {
    assert.equal(actual.stopReason, expected.stopReason, 'stopReason mismatch');
  }

  if ('exitCode' in expected) {
    assert.equal(actual.exitCode, expected.exitCode, 'exitCode mismatch');
  }

  if (Array.isArray(expected.requiredArtifacts)) {
    const actualArtifacts = Array.isArray(actual.artifacts) ? actual.artifacts : [];
    for (const requiredArtifact of expected.requiredArtifacts) {
      assert.ok(
        actualArtifacts.includes(requiredArtifact),
        `missing required artifact: ${requiredArtifact}`
      );
    }
  }
}
