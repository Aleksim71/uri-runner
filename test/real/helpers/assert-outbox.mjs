// path: test/real/helpers/assert-outbox.mjs
import fs from 'node:fs';

const [actualPath, expectedPath] = process.argv.slice(2);
if (!actualPath || !expectedPath) {
  console.error('Usage: node assert-outbox.mjs <actual.json> <expected.json>');
  process.exit(2);
}

const actual = JSON.parse(fs.readFileSync(actualPath, 'utf8'));
const expected = JSON.parse(fs.readFileSync(expectedPath, 'utf8'));

const normalize = (value) => JSON.stringify(value, null, 2);
if (normalize(actual) !== normalize(expected)) {
  console.error('Outbox mismatch.');
  console.error('--- ACTUAL ---');
  console.error(normalize(actual));
  console.error('--- EXPECTED ---');
  console.error(normalize(expected));
  process.exit(1);
}

console.log('Outbox matches expected JSON.');
