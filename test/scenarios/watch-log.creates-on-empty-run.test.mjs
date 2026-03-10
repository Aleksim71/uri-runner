import { describe, it, expect } from 'vitest';
import fs from 'node:fs/promises';
import {
  createSandbox,
  runNodeScript
} from '../helpers/sandbox.cjs';

describe('watch.log', () => {
  it('creates log on empty run', async () => {
    const sandbox = await createSandbox();

    await runNodeScript('src/uram/watch-inbox-once.cjs', [], sandbox);

    const log = await fs.readFile(sandbox.watchLog, 'utf8');

    expect(log).toContain('Scanning:');
    expect(log).toContain('Downloads');
  });
});
