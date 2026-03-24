// path: test/scenarios/outbox.failure-is-valid-zip.test.mjs

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { unzipSync, strFromU8 } from 'fflate';
import { writeFailureOutbox } from '../../src/runtime/watch/write-failure-outbox.cjs';

describe('failure outbox contract', () => {
  it('writes a valid zip with status and error report', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uri-failure-outbox-'));
    const targetZip = path.join(dir, 'outbox.zip');

    writeFailureOutbox({
      targetZip,
      stage: 'execution',
      project: 'uri-runner-next',
      receiver: 'uri',
      profile: 'soft',
      runbookJson: { receiver: 'uri', project: 'uri-runner-next' },
      error: Object.assign(new Error('browser root denied'), { code: 'POLICY_DENIED' })
    });

    const bytes = fs.readFileSync(targetZip);
    expect(bytes[0]).toBe(0x50); // P
    expect(bytes[1]).toBe(0x4b); // K

    const files = unzipSync(bytes);

    expect(strFromU8(files['STATUS.json'])).toMatch(/"status": "failed"/);
    expect(strFromU8(files['STATUS.json'])).toMatch(/"stage": "execution"/);
    expect(strFromU8(files['REPORT/error.json'])).toMatch(/POLICY_DENIED/);
    expect(strFromU8(files['REPORT/error.txt'])).toMatch(/browser root denied/);
    expect(strFromU8(files['REPORT/runbook.json'])).toMatch(/uri-runner-next/);
    expect(strFromU8(files['SNAPSHOT.txt'])).toMatch(/result: failed/);
  });
});
