import { describe, it, expect } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  createSandbox,
  runNodeScript
} from '../helpers/sandbox.cjs';
import { makeZip } from '../helpers/zip-create.cjs';

describe('last_run.txt', () => {
  it('exists after accepted inbox', async () => {
    const sandbox = await createSandbox();

    const metaPath = path.join(sandbox.root, 'META.json');
    await fs.writeFile(
      metaPath,
      JSON.stringify(
        {
          version: 1,
          project: 'uri-runner',
          kind: 'patch'
        },
        null,
        2
      ),
      'utf8'
    );

    const inboxZipPath = path.join(sandbox.downloads, 'inbox.zip');
    await makeZip(inboxZipPath, {
      'META.json': metaPath
    });

    await runNodeScript('src/uram/watch-inbox-once.cjs', [], sandbox);

    const value = await fs.readFile(sandbox.lastRun, 'utf8');

    expect(value.trim().length).toBeGreaterThan(0);
  });
});
