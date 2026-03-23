// path: src/runtime/terminal/execute-terminal-step.cjs

const path = require('node:path');
const { spawn } = require('node:child_process');

function serializeSpawnError(error) {
  if (!error) {
    return null;
  }

  return {
    name: error.name || 'Error',
    message: error.message || 'Unknown spawn error',
    code: error.code || null,
  };
}

function normalizeArgs(args) {
  if (!Array.isArray(args)) {
    return [];
  }

  return args.map((value) => String(value));
}

async function executeTerminalStep(options = {}) {
  const {
    step = {},
    projectRoot = process.cwd(),
    env = {},
    timeoutMs,
    spawnImpl = spawn,
    now = () => new Date().toISOString(),
  } = options;

  const command = String(step.command || '').trim();
  const args = normalizeArgs(step.args);
  const cwd = path.resolve(projectRoot, step.cwd || '.');
  const shell = Boolean(step.shell);
  const effectiveTimeoutMs = Number.isFinite(timeoutMs)
    ? timeoutMs
    : Number.isFinite(step.timeoutMs)
      ? step.timeoutMs
      : 120_000;

  if (!command) {
    return {
      kind: 'terminal-execution',
      command: '',
      args,
      cwd,
      startedAt: now(),
      finishedAt: now(),
      durationMs: 0,
      exitCode: null,
      signal: null,
      stdout: '',
      stderr: '',
      spawnError: {
        name: 'ValidationError',
        message: 'Terminal step command is required.',
        code: 'TERMINAL_COMMAND_REQUIRED',
      },
      timedOut: false,
    };
  }

  return await new Promise((resolve) => {
    const startedAt = now();
    const startedAtMs = Date.now();
    let stdout = '';
    let stderr = '';
    let settled = false;
    let timedOut = false;
    let timeoutId = null;

    const child = spawnImpl(command, args, {
      cwd,
      env: {
        ...process.env,
        ...step.env,
        ...env,
      },
      shell,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const finish = (payload) => {
      if (settled) {
        return;
      }

      settled = true;

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      const finishedAt = now();
      const durationMs = Date.now() - startedAtMs;

      resolve({
        kind: 'terminal-execution',
        command,
        args,
        cwd,
        startedAt,
        finishedAt,
        durationMs,
        exitCode: payload.exitCode ?? null,
        signal: payload.signal ?? null,
        stdout,
        stderr,
        spawnError: serializeSpawnError(payload.spawnError),
        timedOut,
      });
    };

    if (child.stdout) {
      child.stdout.on('data', (chunk) => {
        stdout += String(chunk);
      });
    }

    if (child.stderr) {
      child.stderr.on('data', (chunk) => {
        stderr += String(chunk);
      });
    }

    child.on('error', (error) => {
      finish({ spawnError: error, exitCode: null, signal: null });
    });

    child.on('close', (exitCode, signal) => {
      finish({ exitCode, signal, spawnError: null });
    });

    if (Number.isFinite(effectiveTimeoutMs) && effectiveTimeoutMs > 0) {
      timeoutId = setTimeout(() => {
        timedOut = true;

        try {
          child.kill('SIGTERM');
        } catch (error) {
          finish({ spawnError: error, exitCode: null, signal: 'SIGTERM' });
        }
      }, effectiveTimeoutMs);
    }
  });
}

module.exports = {
  executeTerminalStep,
};
