"use strict";

const { spawn } = require("child_process");

function nowIso() {
  return new Date().toISOString();
}

function normalizeStartupPolicy(startup) {
  const source =
    startup && typeof startup === "object" && !Array.isArray(startup)
      ? startup
      : {};

  return {
    command:
      typeof source.command === "string" ? source.command.trim() : "",
  };
}

async function startManagedServer({
  startup = {},
  cwd,
  env = process.env,
  spawnFn = spawn,
  detached = true,
} = {}) {
  const normalizedStartup = normalizeStartupPolicy(startup);

  if (!normalizedStartup.command) {
    return {
      attempted: false,
      pid: null,
      command: "",
      cwd: typeof cwd === "string" ? cwd : "",
      startedAt: nowIso(),
    };
  }

  if (typeof cwd !== "string" || cwd.trim().length === 0) {
    throw new Error("start-managed-server requires cwd");
  }

  const child = spawnFn(normalizedStartup.command, {
    cwd,
    env,
    shell: true,
    detached,
    stdio: "ignore",
  });

  const startedAt = nowIso();

  return await new Promise((resolve, reject) => {
    let settled = false;

    function finishSuccess() {
      if (settled) {
        return;
      }
      settled = true;

      try {
        if (typeof child.unref === "function") {
          child.unref();
        }
      } catch {
        // ignore unref failures
      }

      resolve({
        attempted: true,
        pid: Number.isInteger(child.pid) ? child.pid : null,
        command: normalizedStartup.command,
        cwd,
        startedAt,
      });
    }

    function finishError(error) {
      if (settled) {
        return;
      }
      settled = true;

      reject(
        new Error(
          `Failed to start managed server: ${
            error?.message || "unknown startup error"
          }`
        )
      );
    }

    child.once("spawn", finishSuccess);
    child.once("error", finishError);

    if (typeof child.pid === "number" && child.pid > 0) {
      queueMicrotask(finishSuccess);
    }
  });
}

module.exports = {
  normalizeStartupPolicy,
  startManagedServer,
};
