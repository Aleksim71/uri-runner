// path: test/unit/command-registry.apply-classification-response.test.mjs
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { applyClassificationResponse } from '../../src/runtime/command-registry/apply-classification-response.cjs';

describe('command-registry applyClassificationResponse', () => {
  it('adds a new command entry to the registry', async () => {
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'uri-registry-'));
    const registryPath = path.join(tmpRoot, 'command-registry.yaml');
    const reportDir = path.join(tmpRoot, 'report');

    await fs.writeFile(
      registryPath,
      [
        'version: 1',
        'defaults:',
        '  on_unknown: classification_required',
        'profiles:',
        '  instant:',
        '    timeout_ms: 4000',
        'commands:',
        '  - id: inspect.pwd',
        '    group: inspect',
        '    profile: instant',
        '    match:',
        '      cmd: pwd',
        '',
      ].join('\n'),
      'utf8'
    );

    const report = await applyClassificationResponse({
      registryPath,
      reportDir,
      sourcePath: '/tmp/CLASSIFICATION_RESPONSE.yaml',
      response: {
        version: 1,
        commands: [
          {
            id: 'shell.bash.inline',
            group: 'shell',
            profile: 'instant',
            match: {
              cmd: 'bash',
              args_prefix: ['-lc'],
            },
          },
        ],
      },
    });

    const nextRegistryText = await fs.readFile(registryPath, 'utf8');

    assert.equal(report.ok, true);
    assert.equal(report.added, 1);
    assert.match(nextRegistryText, /shell\.bash\.inline/);
    assert.match(nextRegistryText, /cmd: bash/);
    assert.match(nextRegistryText, /-lc/);
  });

  it('rejects an invalid classification response', async () => {
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'uri-registry-'));
    const registryPath = path.join(tmpRoot, 'command-registry.yaml');

    let caught = null;

    try {
      await applyClassificationResponse({
        registryPath,
        response: {
          version: 1,
          commands: [],
        },
      });
    } catch (error) {
      caught = error;
    }

    assert.ok(caught);
    assert.equal(caught.code, 'CLASSIFICATION_RESPONSE_INVALID');
  });
});
