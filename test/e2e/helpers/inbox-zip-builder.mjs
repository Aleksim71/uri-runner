// path: test/e2e/helpers/inbox-zip-builder.mjs

import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

function runPython(args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn('python3', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(new Error(`python3 exited with code ${code}\n${stderr}`));
    });

    if (input) {
      child.stdin.write(input);
    }

    child.stdin.end();
  });
}

async function writeEntries(rootDir, entries) {
  for (const entry of entries) {
    const filePath = path.join(rootDir, entry.path);
    await mkdir(path.dirname(filePath), { recursive: true });

    if (entry.kind === 'json') {
      await writeFile(filePath, `${JSON.stringify(entry.value, null, 2)}\n`, 'utf8');
      continue;
    }

    await writeFile(filePath, entry.value, entry.encoding ?? 'utf8');
  }
}

async function createZipFromDirectory(sourceDir, zipPath) {
  const script = `
import os
import sys
import zipfile

source_dir = sys.argv[1]
zip_path = sys.argv[2]

with zipfile.ZipFile(zip_path, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
    for root, _, files in os.walk(source_dir):
        for name in sorted(files):
            full_path = os.path.join(root, name)
            arc_name = os.path.relpath(full_path, source_dir)
            archive.write(full_path, arc_name)
`;

  await runPython(['-c', script, sourceDir, zipPath]);
}

export async function createZipFromEntries({ zipPath, entries }) {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'uri-inbox-entries-'));

  try {
    await writeEntries(tempDir, entries);
    await createZipFromDirectory(tempDir, zipPath);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

export async function createBrokenInboxZip({ zipPath, mode = 'not-a-zip' }) {
  if (mode === 'not-a-zip') {
    await writeFile(zipPath, 'NOT_A_REAL_ZIP\n', 'utf8');
    return;
  }

  if (mode === 'missing-contract-file') {
    await createZipFromEntries({
      zipPath,
      entries: [
        {
          path: 'README.txt',
          value: 'Archive is a valid zip, but intentionally does not satisfy the inbox contract.\n',
        },
      ],
    });
    return;
  }

  throw new Error(`Unsupported broken inbox mode: ${mode}`);
}
