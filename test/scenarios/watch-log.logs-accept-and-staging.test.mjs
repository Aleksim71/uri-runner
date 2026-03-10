import { describe, it, expect } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  createSandbox,
  runNodeScript
} from '../helpers/sandbox.cjs';
import { makeZip } from '../helpers/zip-create.cjs';

describe('watch.log', () => {
  it('logs accept and staging', async () => {
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

    const log = await fs.readFile(sandbox.watchLog, 'utf8');

    expect(log).toContain('accepted inbox.zip with META.json');
    expect(log).toContain('staged inbox.zip ->');
  });
});
