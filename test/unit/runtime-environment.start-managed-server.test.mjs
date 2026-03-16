import { describe, expect, it, vi } from "vitest";

import {
  normalizeStartupPolicy,
  startManagedServer,
} from "../../src/runtime/environment/start-managed-server.cjs";

function createFakeChild({
  pid = 12345,
  emitSpawn = true,
  emitError = null,
} = {}) {
  const listeners = new Map();

  const child = {
    pid,
    once(eventName, handler) {
      listeners.set(eventName, handler);

      if (eventName === "spawn" && emitSpawn) {
        queueMicrotask(() => {
          const fn = listeners.get("spawn");
          if (fn) {
            fn();
          }
        });
      }

      if (eventName === "error" && emitError) {
        queueMicrotask(() => {
          const fn = listeners.get("error");
          if (fn) {
            fn(emitError);
          }
        });
      }

      return child;
    },
    unref: vi.fn(),
  };

  return child;
}

describe("runtime environment start managed server", () => {
  it("normalizes startup policy", () => {
    expect(normalizeStartupPolicy(undefined)).toEqual({
      command: "",
    });

    expect(
      normalizeStartupPolicy({
        command: "  npm run dev  ",
      })
    ).toEqual({
      command: "npm run dev",
    });
  });

  it("returns attempted false when startup command is empty", async () => {
    const spawnFn = vi.fn();

    const result = await startManagedServer({
      startup: {
        command: "",
      },
      cwd: "/tmp/project",
      spawnFn,
    });

    expect(result.attempted).toBe(false);
    expect(result.pid).toBe(null);
    expect(result.command).toBe("");
    expect(result.cwd).toBe("/tmp/project");
    expect(typeof result.startedAt).toBe("string");

    expect(spawnFn).not.toHaveBeenCalled();
  });

  it("starts configured command and returns pid and metadata", async () => {
    const child = createFakeChild({
      pid: 45678,
      emitSpawn: true,
    });

    const spawnFn = vi.fn(() => child);

    const result = await startManagedServer({
      startup: {
        command: "npm run dev",
      },
      cwd: "/tmp/project",
      env: {
        TEST_ENV: "1",
      },
      spawnFn,
    });

    expect(spawnFn).toHaveBeenCalledTimes(1);
    expect(spawnFn).toHaveBeenCalledWith("npm run dev", {
      cwd: "/tmp/project",
      env: {
        TEST_ENV: "1",
      },
      shell: true,
      detached: true,
      stdio: "ignore",
    });

    expect(result.attempted).toBe(true);
    expect(result.pid).toBe(45678);
    expect(result.command).toBe("npm run dev");
    expect(result.cwd).toBe("/tmp/project");
    expect(typeof result.startedAt).toBe("string");

    expect(child.unref).toHaveBeenCalledTimes(1);
  });

  it("reports failure on startup error", async () => {
    const child = createFakeChild({
      pid: null,
      emitSpawn: false,
      emitError: new Error("spawn ENOENT"),
    });

    const spawnFn = vi.fn(() => child);

    await expect(
      startManagedServer({
        startup: {
          command: "npm run dev",
        },
        cwd: "/tmp/project",
        spawnFn,
      })
    ).rejects.toThrow("Failed to start managed server: spawn ENOENT");
  });

  it("fails when cwd is missing for non-empty command", async () => {
    await expect(
      startManagedServer({
        startup: {
          command: "npm run dev",
        },
      })
    ).rejects.toThrow("start-managed-server requires cwd");
  });
});
