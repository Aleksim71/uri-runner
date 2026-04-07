// path: test/real/db_query.profile.real.test.mjs
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

describe('real profile: db_query', () => {
  it('db_query.success', async () => {
    const caseName = 'db_query.success';
    const result = await runUriRealCase({ caseName });
    assert.ok(result.normalizedOutbox, `outbox was not produced: ${result.runResult?.errorMessage || 'unknown error'}`);
    await assertCurrentOutbox(result.normalizedOutbox, readExpected(caseName));
  }, 120000);

  it('db_query.retry_then_fail', async () => {
    const caseName = 'db_query.retry_then_fail';
    const result = await runUriRealCase({ caseName });
    assert.ok(result.normalizedOutbox, `outbox was not produced: ${result.runResult?.errorMessage || 'unknown error'}`);
    await assertCurrentOutbox(result.normalizedOutbox, readExpected(caseName));
  }, 120000);
});
