// path: test/unit/write-browser-artifacts.test.mjs

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { writeBrowserArtifacts } from '../../src/runtime/browser/write-browser-artifacts.cjs';

describe('writeBrowserArtifacts', () => {
  it('writes normalized browser artifacts to the artifacts directory', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'uri-browser-artifacts-'));

    const result = await writeBrowserArtifacts(
      {
        kind: 'browser-diagnostics',
        status: 'warning',
        artifacts: [
          { name: 'page-metadata.json', kind: 'json', payload: { title: 'App' } },
          { name: 'screenshot.png', kind: 'binary', payload: Buffer.from('png-data') },
          { name: 'browser-report.json', kind: 'json', payload: { status: 'warning' } },
        ],
      },
      {
        artifactsDir: tempDir,
      }
    );

    expect(result.status).toBe('warning');
    expect(result.written).toHaveLength(3);

    const jsonContent = await fs.readFile(path.join(tempDir, 'page-metadata.json'), 'utf8');
    expect(jsonContent).toContain('"title": "App"');
  });
});
