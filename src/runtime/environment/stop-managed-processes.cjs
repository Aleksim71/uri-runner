"use strict";

const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

function normalizeManagedProcesses(policy) {
  if (!Array.isArray(policy)) {
    return [];
  }

  return policy.filter(
    (entry) => entry && typeof entry === "object" && !Array.isArray(entry)
  );
}

function parsePsOutput(stdout) {
  const lines = String(stdout || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const processes = [];

  for (const line of lines) {
    const match = line.match(/^(\d+)\s+(.*)$/);

    if (!match) {
      continue;
    }

    const pid = Number(match[1]);
    const command = match[2] || "";

    if (!Number.isInteger(pid) || pid <= 0) {
      continue;
    }

    processes.push({ pid, command });
  }

  return processes;
}

function commandMatches(processInfo, managedEntry) {
  if (
    typeof managedEntry.command_contains === "string" &&
    managedEntry.command_contains.trim().length > 0
  ) {
    return processInfo.command.includes(managedEntry.command_contains);
  }

  return false;
}

async function listProcesses() {
  const { stdout } = await execFileAsync("ps", ["-eo", "pid=,args="], {
    maxBuffer: 10 * 1024 * 1024,
  });

  return parsePsOutput(stdout);
}

async function killProcess(pid, signal) {
  await execFileAsync("kill", [`-${signal}`, String(pid)]);
}

async function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function stopOneProcess(processInfo) {
  try {
    await killProcess(processInfo.pid, "TERM");
  } catch (error) {
    return {
      ok: false,
      pid: processInfo.pid,
      command: processInfo.command,
      reason: `TERM failed: ${error.message}`,
    };
  }

  for (let i = 0; i < 10; i += 1) {
    if (!(await isProcessAlive(processInfo.pid))) {
      return {
        ok: true,
        pid: processInfo.pid,
        command: processInfo.command,
        mode: "graceful",
      };
    }

    await sleep(100);
  }

  try {
    await killProcess(processInfo.pid, "KILL");
  } catch (error) {
    return {
      ok: false,
      pid: processInfo.pid,
      command: processInfo.command,
      reason: `KILL failed: ${error.message}`,
    };
  }

  for (let i = 0; i < 10; i += 1) {
    if (!(await isProcessAlive(processInfo.pid))) {
      return {
        ok: true,
        pid: processInfo.pid,
        command: processInfo.command,
        mode: "force",
      };
    }

    await sleep(100);
  }

  return {
    ok: false,
    pid: processInfo.pid,
    command: processInfo.command,
    reason: "process still alive after KILL",
  };
}

async function stopManagedProcesses({
  managedProcesses = [],
  listProcessesFn = listProcesses,
  stopOneProcessFn = stopOneProcess,
} = {}) {
  const normalized = normalizeManagedProcesses(managedProcesses);

  if (normalized.length === 0) {
    return {
      attempted: false,
      stopped: [],
      failed: [],
    };
  }

  const processes = await listProcessesFn();

  const matched = processes.filter((proc) =>
    normalized.some((entry) => commandMatches(proc, entry))
  );

  const stopped = [];
  const failed = [];
  const seen = new Set();

  for (const proc of matched) {
    const key = `${proc.pid}:${proc.command}`;

    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    const result = await stopOneProcessFn(proc);

    if (result && result.ok) {
      stopped.push({
        pid: result.pid,
        command: result.command,
        mode: result.mode || "graceful",
      });
    } else {
      failed.push({
        pid: result?.pid ?? proc.pid,
        command: result?.command ?? proc.command,
        reason: result?.reason || "unknown stop failure",
      });
    }
  }

  return {
    attempted: true,
    stopped,
    failed,
  };
}

module.exports = {
  parsePsOutput,
  stopOneProcess,
  stopManagedProcesses,
};
