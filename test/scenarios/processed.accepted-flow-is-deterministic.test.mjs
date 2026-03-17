import { describe, it, expect } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  createSandbox,
  runNodeScript,
  listDir,
  readText
} from '../helpers/sandbox.cjs';
import { makeZip } from '../helpers/zip-create.cjs';

describe('processed/', () => {
  it('creates deterministic accepted-flow marker', async () => {
    const sandbox = await createSandbox();

    const runbookPath = path.join(sandbox.root, 'RUNBOOK.yaml');
    await fs.writeFile(
      runbookPath,
`receiver: uri
project: uri-runner
goal: deterministic test
goal_checks: []
max_attempts: 1
provide: []
modify: []
`,
      'utf8'
    );

    const inboxZipPath = path.join(sandbox.downloads, 'inbox.zip');
    await makeZip(inboxZipPath, {
      'RUNBOOK.yaml': runbookPath
    });

    await runNodeScript('src/uram/watch-inbox-once.cjs', [], sandbox);

    const processedEntries = listDir(sandbox.processed);
    expect(processedEntries).toEqual(['inbox.processed.txt']);

    const markerPath = path.join(sandbox.processed, 'inbox.processed.txt');
    const markerText = readText(markerPath);

    expect(markerText).toContain('accepted inbox.zip');
  });
});
