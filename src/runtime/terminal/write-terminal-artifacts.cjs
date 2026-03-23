// path: src/runtime/terminal/write-terminal-artifacts.cjs

const path = require('node:path');
const fs = require('node:fs/promises');

function toProjectPath(absolutePath, relativeTo) {
  if (!relativeTo) {
    return path.basename(absolutePath);
  }

  return path.relative(relativeTo, absolutePath).split(path.sep).join('/');
}

async function writeTerminalArtifacts(options = {}) {
  const {
    terminalResult = {},
    artifactsDir,
    relativeTo,
    fsImpl = fs,
  } = options;

  if (!artifactsDir) {
    throw new Error('artifactsDir is required');
  }

  await fsImpl.mkdir(artifactsDir, { recursive: true });

  const stdoutPathAbs = path.join(artifactsDir, 'stdout.txt');
  const stderrPathAbs = path.join(artifactsDir, 'stderr.txt');
  const resultPathAbs = path.join(artifactsDir, 'terminal-result.json');

  let stdoutPath = null;
  let stderrPath = null;

  if (terminalResult.stdout) {
    await fsImpl.writeFile(stdoutPathAbs, terminalResult.stdout, 'utf8');
    stdoutPath = toProjectPath(stdoutPathAbs, relativeTo);
  }

  if (terminalResult.stderr) {
    await fsImpl.writeFile(stderrPathAbs, terminalResult.stderr, 'utf8');
    stderrPath = toProjectPath(stderrPathAbs, relativeTo);
  }

  const publicResult = {
    type: terminalResult.type || 'terminal',
    status: terminalResult.status || 'failed',
    command: terminalResult.command || '',
    args: Array.isArray(terminalResult.args) ? terminalResult.args : [],
    cwd: terminalResult.cwd || '.',
    shell: Boolean(terminalResult.shell),
    exitCode: terminalResult.exitCode ?? null,
    signal: terminalResult.signal ?? null,
    durationMs: Number.isFinite(terminalResult.durationMs) ? terminalResult.durationMs : 0,
    failureKind: terminalResult.failureKind ?? null,
    summary: terminalResult.summary || '',
    startedAt: terminalResult.startedAt || null,
    finishedAt: terminalResult.finishedAt || null,
    stdoutBytes: Number.isFinite(terminalResult.stdoutBytes) ? terminalResult.stdoutBytes : 0,
    stderrBytes: Number.isFinite(terminalResult.stderrBytes) ? terminalResult.stderrBytes : 0,
    stdoutPath,
    stderrPath,
  };

  await fsImpl.writeFile(resultPathAbs, `${JSON.stringify(publicResult, null, 2)}\n`, 'utf8');

  return {
    ...terminalResult,
    stdoutPath,
    stderrPath,
    resultPath: toProjectPath(resultPathAbs, relativeTo),
  };
}

module.exports = {
  writeTerminalArtifacts,
};
