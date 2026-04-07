// path: test/audit.classification-response.test.mjs
import { describe, it, expect } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import unzipper from 'unzipper';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import auditCjs from '../src/commands/context/audit.cjs';

const execFileAsync = promisify(execFile);
const { runAudit } = auditCjs;

async function unzipToMem(zipPath) {
  const dir = await unzipper.Open.file(zipPath);
  const names = dir.files.map((f) => f.path);
  const getText = async (name) => {
    const f = dir.files.find((x) => x.path === name);
    if (!f) return null;
    const buf = await f.buffer();
    return buf.toString('utf8');
  };
  return { names, getText };
}

async function zipDir(sourceDir, zipPath) {
  await fs.ensureDir(path.dirname(zipPath));
  await execFileAsync('zip', ['-rDq', zipPath, '.'], { cwd: sourceDir });
}

describe('audit classification response', () => {
  it('applies classification response, reruns preflight, and executes checks', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'uri-runner-'));
    const repo = path.join(tmp, 'repo');
    await fs.ensureDir(repo);

    const inboxStage = path.join(tmp, 'inbox-stage');
    const inboxDir = path.join(repo, 'artifacts', 'inbox');
    const outboxDir = path.join(repo, 'artifacts', 'outbox');
    const registryPath = path.join(repo, 'config', 'command-registry.yaml');
    const inboxZip = path.join(inboxDir, 'inbox.zip');
    const outboxZip = path.join(outboxDir, 'outbox.zip');

    await fs.ensureDir(inboxStage);
    await fs.ensureDir(inboxDir);
    await fs.ensureDir(outboxDir);
    await fs.ensureDir(path.dirname(registryPath));

    await fs.copyFile(
      path.resolve('config', 'command-registry.yaml'),
      registryPath
    );

    await fs.writeFile(
      path.join(inboxStage, 'RUNBOOK.yaml'),
      [
        'version: 1',
        'receiver: uri',
        'project: uri-runner',
        'profile: audit',
        'cwd: .',
        'audit:',
        '  checks:',
        '    - name: classified_echo',
        '      cmd: bash',
        '      args:',
        '        - -lc',
        '        - printf "classified-ok\\n"',
        '',
      ].join('\n'),
      'utf8'
    );

    await fs.writeFile(
      path.join(inboxStage, 'CLASSIFICATION_RESPONSE.yaml'),
      [
        'version: 1',
        'commands:',
        '  - id: shell.bash.inline',
        '    group: shell',
        '    profile: instant',
        '    match:',
        '      cmd: bash',
        '      args_prefix:',
        '        - -lc',
        '',
      ].join('\n'),
      'utf8'
    );

    await zipDir(inboxStage, inboxZip);

    const res = await runAudit({
      cwd: repo,
      inboxPath: inboxZip,
      outboxPath: outboxZip,
      workspaceDir: path.join(repo, '.runner-work'),
      commandRegistry: {
        enabled: true,
        registryPath,
      },
    });

    expect(res.exitCode).toBe(0);
    expect(res.status.ok).toBe(true);
    expect(await fs.pathExists(outboxZip)).toBe(true);

    const z = await unzipToMem(outboxZip);
    expect(z.names).toContain('REPORT/classification-response.apply.json');
    expect(z.names).toContain('REPORT/checks.classified_echo.out.log');

    const applyText = await z.getText('REPORT/classification-response.apply.json');
    const applyReport = JSON.parse(applyText);
    expect(applyReport.added).toBe(1);

    const checkOutText = await z.getText('REPORT/checks.classified_echo.out.log');
    expect(checkOutText).toContain('classified-ok');
  });
});
