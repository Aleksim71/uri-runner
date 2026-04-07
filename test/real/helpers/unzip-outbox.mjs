// path: test/real/helpers/unzip-outbox.mjs
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const zipFile = process.argv[2];
const outDir = process.argv[3];

if (!zipFile || !outDir) {
  throw new Error('Usage: node test/real/helpers/unzip-outbox.mjs <outbox.zip> <dest-dir>');
}

fs.mkdirSync(path.resolve(outDir), { recursive: true });
execFileSync('unzip', ['-o', zipFile, '-d', outDir], { stdio: 'inherit' });
