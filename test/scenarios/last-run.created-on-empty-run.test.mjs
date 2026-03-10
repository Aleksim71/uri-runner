import { describe, it, expect } from 'vitest';
import fs from 'node:fs/promises';
import {
  createSandbox,
  runNodeScript
} from '../helpers/sandbox.cjs';

describe('last_run.txt', () => {
  it('creates file on empty run', async () => {
    const sandbox = await createSandbox();

    await runNodeScript('src/uram/watch-inbox-once.cjs', [], sandbox);

    const value = await fs.readFile(sandbox.lastRun, 'utf8');

    expect(value.trim().length).toBeGreaterThan(0);
  });
});
