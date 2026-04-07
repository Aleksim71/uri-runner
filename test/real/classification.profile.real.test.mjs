// path: test/real/classification.profile.real.test.mjs
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { runUriRealCase } from './helpers/run-uri-real-case.mjs';
import { assertCurrentOutbox } from './helpers/assert-current-outbox.mjs';

function readExpected(caseName) {
  const filePath = path.join(process.cwd(), 'test', 'real', 'cases', caseName, 'EXPECTED', 'expected-outbox.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function resolveClassificationRequestPath(outboxDir, fileName) {
  const reportPath = path.join(outboxDir, 'REPORT', fileName);
  if (fs.existsSync(reportPath)) {
    return reportPath;
  }

  const providedPath = path.join(outboxDir, 'provided', fileName);
  if (fs.existsSync(providedPath)) {
    return providedPath;
  }

  return reportPath;
}

describe('real profile: classification', () => {
  it('classification_required.unknown_command', async () => {
    const caseName = 'classification_required.unknown_command';
    const result = await runUriRealCase({ caseName });

    assert.ok(
      result.normalizedOutbox,
      `outbox was not produced: ${result.runResult?.errorMessage || 'unknown error'}`
    );

    await assertCurrentOutbox(result.normalizedOutbox, readExpected(caseName));

    const requestJsonPath = resolveClassificationRequestPath(result.outboxDir, 'classification-request.json');
    const requestYamlPath = resolveClassificationRequestPath(result.outboxDir, 'classification-request.yaml');

    assert.ok(
      fs.existsSync(requestJsonPath),
      'classification-request.json must exist in REPORT/ or provided/'
    );
    assert.ok(
      fs.existsSync(requestYamlPath),
      'classification-request.yaml must exist in REPORT/ or provided/'
    );

    const request = readJson(requestJsonPath);
    assert.equal(request.status, 'classification_required', 'classification request status mismatch');
    assert.ok(Array.isArray(request.unknown_commands), 'unknown_commands must be an array');
    assert.equal(request.unknown_commands.length, 1, 'expected exactly one unknown command');

    const requestText = JSON.stringify(request);
    assert.match(
      requestText,
      /totally-unknown-dev-command/,
      'classification request must mention the unknown command'
    );
  }, 120000);
});
