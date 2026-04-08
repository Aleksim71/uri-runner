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

describe('real profile: scenario', () => {
  it('scenario.success.basic', async () => {
    const caseName = 'scenario.success.basic';
    const result = await runUriRealCase({ caseName });

    assert.ok(
      result.normalizedOutbox,
      `outbox was not produced: ${result.runResult?.errorMessage || 'unknown error'}`
    );

    await assertCurrentOutbox(result.normalizedOutbox, readExpected(caseName));

    const outboxJsonPath = path.join(result.outboxDir, 'outbox.json');
    assert.ok(fs.existsSync(outboxJsonPath), 'outbox.json must exist');

    const outbox = readJson(outboxJsonPath);
    assert.equal(outbox.status, 'success', 'final outbox status must be success');
  }, 120000);

  it('scenario.classification_required.unknown_named', async () => {
    const caseName = 'scenario.classification_required.unknown_named';
    const result = await runUriRealCase({ caseName });

    assert.ok(
      result.normalizedOutbox,
      `outbox was not produced: ${result.runResult?.errorMessage || 'unknown error'}`
    );

    await assertCurrentOutbox(result.normalizedOutbox, readExpected(caseName));

    const outboxJsonPath = path.join(result.outboxDir, 'outbox.json');
    assert.ok(fs.existsSync(outboxJsonPath), 'outbox.json must exist');

    const outbox = readJson(outboxJsonPath);
    assert.equal(
      outbox.status,
      'classification_required',
      'final outbox status must be classification_required'
    );
    assert.equal(outbox.error?.code, 'CLASSIFICATION_REQUIRED', 'error.code mismatch');
    assert.ok(
      outbox.classification_request && typeof outbox.classification_request === 'object',
      'classification_request must be present in outbox.json'
    );
    assert.equal(outbox.classification_request.engine, 'scenario', 'classification_request.engine mismatch');
    assert.ok(
      Array.isArray(outbox.classification_request.unknown_steps),
      'classification_request.unknown_steps must be an array'
    );
    assert.equal(
      outbox.classification_request.unknown_steps.length,
      1,
      'expected exactly one unknown scenario step'
    );

    const requestText = JSON.stringify(outbox.classification_request);
    assert.match(
      requestText,
      /project\.local-hello/,
      'classification request must mention the unknown scenario command'
    );
  }, 120000);

  it('scenario.classification_response.applies_and_executes', async () => {
    const caseName = 'scenario.classification_response.applies_and_executes';
    const result = await runUriRealCase({ caseName });

    assert.ok(
      result.normalizedOutbox,
      `outbox was not produced: ${result.runResult?.errorMessage || 'unknown error'}`
    );

    await assertCurrentOutbox(result.normalizedOutbox, readExpected(caseName));

    const outboxJsonPath = path.join(result.outboxDir, 'outbox.json');
    assert.ok(fs.existsSync(outboxJsonPath), 'outbox.json must exist');

    const outbox = readJson(outboxJsonPath);
    assert.equal(outbox.status, 'success', 'final outbox status must be success');
    assert.ok(
      outbox.exitCode == null || outbox.exitCode === 0,
      'final outbox exitCode must be 0 when present'
    );
  }, 120000);

  it('scenario.classification_required.unknown_browser_action', async () => {
    const caseName = 'scenario.classification_required.unknown_browser_action';
    const result = await runUriRealCase({ caseName });

    assert.ok(
      result.normalizedOutbox,
      `outbox was not produced: ${result.runResult?.errorMessage || 'unknown error'}`
    );

    await assertCurrentOutbox(result.normalizedOutbox, readExpected(caseName));

    const outboxJsonPath = path.join(result.outboxDir, 'outbox.json');
    assert.ok(fs.existsSync(outboxJsonPath), 'outbox.json must exist');

    const outbox = readJson(outboxJsonPath);
    assert.equal(
      outbox.status,
      'classification_required',
      'final outbox status must be classification_required'
    );
    assert.equal(outbox.error?.code, 'CLASSIFICATION_REQUIRED', 'error.code mismatch');
    assert.ok(
      outbox.classification_request && typeof outbox.classification_request === 'object',
      'classification_request must be present in outbox.json'
    );
    assert.equal(outbox.classification_request.engine, 'scenario', 'classification_request.engine mismatch');
    assert.ok(
      Array.isArray(outbox.classification_request.unknown_steps),
      'classification_request.unknown_steps must be an array'
    );
    assert.equal(
      outbox.classification_request.unknown_steps.length,
      1,
      'expected exactly one unknown scenario browser-flow step'
    );

    const [unknownStep] = outbox.classification_request.unknown_steps;
    assert.equal(
      unknownStep.kind,
      'command',
      'unknown browser-flow step must compile to command'
    );
    assert.equal(
      unknownStep.command,
      'browser.diagnostics.collect',
      'unknown browser-flow command mismatch'
    );
  }, 120000);

  it('scenario.classification_response.browser_applies_and_executes', async () => {
    const caseName = 'scenario.classification_response.browser_applies_and_executes';
    const result = await runUriRealCase({ caseName });

    assert.ok(
      result.normalizedOutbox,
      `outbox was not produced: ${result.runResult?.errorMessage || 'unknown error'}`
    );

    await assertCurrentOutbox(result.normalizedOutbox, readExpected(caseName));

    const outboxJsonPath = path.join(result.outboxDir, 'outbox.json');
    assert.ok(fs.existsSync(outboxJsonPath), 'outbox.json must exist');

    const outbox = readJson(outboxJsonPath);
    assert.equal(outbox.status, 'success', 'final outbox status must be success');
    assert.ok(
      outbox.exitCode == null || outbox.exitCode === 0,
      'final outbox exitCode must be 0 when present'
    );
  }, 120000);
});
