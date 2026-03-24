
import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';

const PROJECT_ROOT = process.cwd();
const DOWNLOADS = process.env.HOME + '/Загрузки';
const INBOX_PATH = path.join(DOWNLOADS, 'inbox.zip');

describe('watch pipeline happy path (fixed)', () => {
  it('processes valid inbox.zip and returns provided files', () => {
    try { rmSync(INBOX_PATH); } catch {}

    execSync(`
      rm -rf /tmp/inbox-test &&
      mkdir -p /tmp/inbox-test &&
      cat > /tmp/inbox-test/META.json << 'EOF'
{
  "receiver": "uri",
  "type": "run"
}
EOF
      cat > /tmp/inbox-test/RUNBOOK.yaml << 'EOF'
receiver: uri
version: 1
project: uri-runner
goal: truth test
steps:
  - id: step_echo_1
    command: system.echo
    args:
      message: "truth test"
provide:
  - kind: file
    path: package.json
  - kind: file
    path: doc/runtime/runtime-architecture.txt
EOF
      cd /tmp/inbox-test &&
      zip -r ${INBOX_PATH} .
    `, { stdio: 'inherit', shell: '/bin/bash' });

    const output = execSync('uri watch --once', { encoding: 'utf-8' });

    expect(output).toMatch(/inbox\.zip detected/i);
    expect(existsSync(INBOX_PATH)).toBe(false);

    const outboxJsonPath = path.join(PROJECT_ROOT, 'runtime/watch/processed/outbox.json');
    const outbox = JSON.parse(require('fs').readFileSync(outboxJsonPath, 'utf-8'));

    expect(outbox.status).toBe('success');
    expect(outbox.fileDeliveryReport.summary.provided).toBe(2);
  });
});
