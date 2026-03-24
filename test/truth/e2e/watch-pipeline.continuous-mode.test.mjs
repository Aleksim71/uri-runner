
// path: test/truth/e2e/watch-pipeline.continuous-mode.test.mjs

import { describe, it, expect } from 'vitest';
import { spawn, execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';

const PROJECT_ROOT = process.cwd();
const DOWNLOADS = path.join(process.env.HOME || '', 'Загрузки');
const INBOX_PATH = path.join(DOWNLOADS, 'inbox.zip');
const OUTBOX_JSON_PATH = path.join(PROJECT_ROOT, 'runtime/watch/processed/outbox.json');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildValidInbox() {
  execSync(`
    set -euo pipefail
    rm -rf /tmp/inbox-test
    mkdir -p /tmp/inbox-test
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
goal: truth continuous test
steps:
  - id: step_echo_1
    command: system.echo
    args:
      message: "truth continuous test"
provide:
  - kind: file
    path: package.json
  - kind: file
    path: doc/runtime/runtime-architecture.txt
EOF
    cd /tmp/inbox-test
    rm -f "${INBOX_PATH}"
    zip -r "${INBOX_PATH}" .
  `, {
    stdio: 'inherit',
    shell: '/bin/bash',
    env: { ...process.env, INBOX_PATH },
  });
}

async function waitFor(predicate, timeoutMs, intervalMs = 200) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const value = await predicate();
    if (value) return value;
    await sleep(intervalMs);
  }
  return null;
}

describe('watch pipeline continuous mode', () => {
  it('processes valid inbox.zip and returns provided files', async () => {
    try { rmSync(INBOX_PATH, { force: true }); } catch {}
    mkdirSync(DOWNLOADS, { recursive: true });

    buildValidInbox();
    expect(existsSync(INBOX_PATH)).toBe(true);

    const child = spawn('uri', ['watch'], {
      cwd: PROJECT_ROOT,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    try {
      const outbox = await waitFor(() => {
        if (!existsSync(OUTBOX_JSON_PATH)) return null;
        try {
          const parsed = JSON.parse(readFileSync(OUTBOX_JSON_PATH, 'utf8'));
          if (parsed && parsed.status === 'success') return parsed;
        } catch {}
        return null;
      }, 10000);

      expect(outbox).toBeTruthy();

      const inboxRemoved = await waitFor(() => !existsSync(INBOX_PATH), 5000);
      expect(inboxRemoved).toBe(true);

      expect(stdout).toMatch(/status: started/i);
      expect(stdout).toMatch(/status: inbox\.zip detected/i);

      expect(outbox.status).toBe('success');
      expect(outbox.fileDeliveryReport.summary.provided).toBe(2);
      expect(outbox.fileDeliveryReport.providedFiles).toContain('package.json');
      expect(outbox.fileDeliveryReport.providedFiles).toContain('doc/runtime/runtime-architecture.txt');
    } finally {
      child.kill('SIGINT');
      await sleep(300);
      if (!child.killed) {
        child.kill('SIGKILL');
      }
    }

    if (stderr.trim()) {
      throw new Error(`uri watch stderr was not empty:\n${stderr}`);
    }
  }, 20000);
});
