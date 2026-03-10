import { describe, it, expect } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  createSandbox,
  runNodeScript
} from '../helpers/sandbox.cjs';

describe('watch.log', () => {
  it('logs ignore reason', async () => {
    const sandbox = await createSandbox();

    const noisePath = path.join(sandbox.downloads, 'notes.txt');
    await fs.writeFile(noisePath, 'hello', 'utf8');

    await runNodeScript('src/uram/watch-inbox-once.cjs', [], sandbox);

    const log = await fs.readFile(sandbox.watchLog, 'utf8');

    expect(log).toContain('ignore non-zip');
    expect(log).toContain('notes.txt');
  });
});
