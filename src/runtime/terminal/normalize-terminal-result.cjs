// path: src/runtime/terminal/normalize-terminal-result.cjs

function toText(value) {
  return typeof value === 'string' ? value : '';
}

function toFailureKind(executionResult = {}) {
  if (executionResult.spawnError) {
    return 'spawn_error';
  }

  if (executionResult.timedOut) {
    return 'timeout';
  }

  if (executionResult.signal) {
    return 'signal';
  }

  if (executionResult.exitCode !== 0) {
    return 'exit_code';
  }

  return null;
}

function buildSummary({ commandLabel, failureKind, exitCode, signal }) {
  if (!failureKind) {
    return `Command completed with exit code 0`;
  }

  if (failureKind === 'spawn_error') {
    return `Command failed to start: ${commandLabel}`;
  }

  if (failureKind === 'timeout') {
    return `Command timed out: ${commandLabel}`;
  }

  if (failureKind === 'signal') {
    return `Command terminated by signal ${signal || 'UNKNOWN'}`;
  }

  return `Command failed with exit code ${exitCode}`;
}

function normalizeTerminalResult(options = {}) {
  const { step = {}, executionResult = {} } = options;

  const stdout = toText(executionResult.stdout);
  const stderr = toText(executionResult.stderr);
  const failureKind = toFailureKind(executionResult);
  const command = String(step.command || executionResult.command || '');
  const args = Array.isArray(step.args)
    ? step.args.map((value) => String(value))
    : Array.isArray(executionResult.args)
      ? executionResult.args.map((value) => String(value))
      : [];
  const shell = Boolean(step.shell);
  const status = failureKind ? 'failed' : 'succeeded';
  const commandLabel = [command, ...args].filter(Boolean).join(' ').trim() || command;

  return {
    type: 'terminal',
    status,
    command,
    args,
    cwd: String(step.cwd || '.'),
    shell,
    exitCode: executionResult.exitCode ?? null,
    signal: executionResult.signal ?? null,
    durationMs: Number.isFinite(executionResult.durationMs) ? executionResult.durationMs : 0,
    failureKind,
    summary: buildSummary({
      commandLabel,
      failureKind,
      exitCode: executionResult.exitCode ?? null,
      signal: executionResult.signal ?? null,
    }),
    startedAt: executionResult.startedAt || null,
    finishedAt: executionResult.finishedAt || null,
    stdout,
    stderr,
    stdoutBytes: Buffer.byteLength(stdout, 'utf8'),
    stderrBytes: Buffer.byteLength(stderr, 'utf8'),
  };
}

module.exports = {
  normalizeTerminalResult,
};
