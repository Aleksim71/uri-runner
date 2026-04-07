// path: test/real/fixtures/browser/action-success.js
const fs = require('node:fs');
const path = require('node:path');
const outputDir = process.env.BROWSER_OUTPUT_DIR || process.cwd();
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'browser-artifact.json'), JSON.stringify({ ok: true }, null, 2));
console.log('browser action success');
process.exit(0);
