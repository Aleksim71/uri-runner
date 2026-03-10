import { describe, it, expect } from 'vitest';
import fs from 'node:fs/promises';
import {
  createSandbox,
  runNodeScript
} from '../helpers/sandbox.cjs';

describe('last_run.txt', () => {
  it('updates on second run', async () => {
    const sandbox = await createSandbox();

    await runNodeScript('src/uram/watch-inbox-once.cjs', [], sandbox);
    const firstValue = await fs.readFile(sandbox.lastRun, 'utf8');

    await new Promise((resolve) => setTimeout(resolve, 30));

    await runNodeScript('src/uram/watch-inbox-once.cjs', [], sandbox);
    const secondValue = await fs.readFile(sandbox.lastRun, 'utf8');

    expect(firstValue.trim().length).toBeGreaterThan(0);
    expect(secondValue.trim().length).toBeGreaterThan(0);
    expect(secondValue).not.toBe(firstValue);
  });
});
