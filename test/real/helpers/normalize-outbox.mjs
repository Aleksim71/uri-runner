// path: test/real/helpers/normalize-outbox.mjs
import fs from 'node:fs';
import path from 'node:path';

// This is a project-specific adapter placeholder.
// Replace the STATUS / REPORT reading rules with the current uri-runner-next outbox shape.

const [unpackedDir, outputJson] = process.argv.slice(2);
if (!unpackedDir || !outputJson) {
  console.error('Usage: node normalize-outbox.mjs <unpackedDir> <outputJson>');
  process.exit(2);
}

const statusPath = path.join(unpackedDir, 'STATUS.json');
const reportDir = path.join(unpackedDir, 'REPORT');

const normalized = {
  status: 'unknown',
  attempts: 1,
  profile: 'unknown',
  stopReason: null,
  artifacts: [],
  checks: {}
};

if (fs.existsSync(statusPath)) {
  try {
    const status = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
    if (typeof status.status === 'string') normalized.status = status.status;
    if (typeof status.attempts === 'number') normalized.attempts = status.attempts;
  } catch {}
}

if (fs.existsSync(reportDir)) {
  normalized.artifacts = fs.readdirSync(reportDir).sort();
}

fs.writeFileSync(outputJson, JSON.stringify(normalized, null, 2));
console.log(`Normalized outbox written to ${outputJson}`);
