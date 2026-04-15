import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { runUriRealCase } from './helpers/run-uri-real-case.mjs';
import { assertCurrentOutbox } from './helpers/assert-current-outbox.mjs';

function readExpected(caseName) {
  const filePath = path.join(
    process.cwd(),
    'test',
    'real',
    'cases',
    caseName,
    'EXPECTED',
    'expected-outbox.json'
  );
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

const CASES = [
  'audit.system.doctor',
  'audit.system.urls',
  'audit.system.exec.success',
  'audit.system.exec.non_zero',
];

describe('real profile: system_audit', () => {
  for (const caseName of CASES) {
    it(caseName, async () => {
      const result = await runUriRealCase({ caseName });

      assert.ok(
        result.normalizedOutbox,
        `outbox was not produced: ${result.runResult?.errorMessage || 'unknown error'}`
      );

      const expectedPath = path.join(
        process.cwd(),
        'test',
        'real',
        'cases',
        caseName,
        'EXPECTED',
        'expected-outbox.json'
      );

      if (fs.existsSync(expectedPath)) {
        await assertCurrentOutbox(result.normalizedOutbox, readExpected(caseName));
      } else {
        assert.equal(
          result.normalizedOutbox.status,
          'success',
          'normalized outbox status must be success'
        );
      }

      const outboxJsonPath = path.join(result.outboxDir, 'outbox.json');
      assert.ok(fs.existsSync(outboxJsonPath), 'outbox.json must exist');

      const outbox = readJson(outboxJsonPath);
      assert.equal(outbox.status, 'success', 'final outbox status must be success');
      assert.ok(
        outbox.exitCode == null || outbox.exitCode === 0,
        'final outbox exitCode must be 0 when present'
      );
    }, 120000);
  }
});
