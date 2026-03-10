import { describe, it, expect } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  createSandbox,
  runNodeScript,
  listDir
} from '../helpers/sandbox.cjs';

describe('processed/', () => {
  it('does not create records for ignored files', async () => {
    const sandbox = await createSandbox();

    const noisePath = path.join(sandbox.downloads, 'notes.txt');
    await fs.writeFile(noisePath, 'hello', 'utf8');

    await runNodeScript('src/uram/watch-inbox-once.cjs', [], sandbox);

    const processedEntries = listDir(sandbox.processed);

    expect(processedEntries).toEqual([]);
  });
});
