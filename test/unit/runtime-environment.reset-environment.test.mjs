import { describe, expect, it, vi } from "vitest";

import { resetEnvironment } from "../../src/runtime/environment/reset-environment.cjs";

describe("runtime environment reset environment orchestrator", () => {
  it("runs stop, cleanup, startup and healthcheck in order", async () => {
    const calls = [];

    const stopManagedProcessesFn = vi.fn(async () => {
      calls.push("stop");
      return {
        attempted: true,
        stopped: [{ pid: 111, command: "node server.js", mode: "graceful" }],
        failed: [],
      };
    });

    const cleanupRuntimeStateFn = vi.fn(async () => {
      calls.push("cleanup");
      return {
        attempted: true,
        scopePaths: ["/tmp/project", "/tmp/workspace"],
        removed: ["/tmp/project/server.pid"],
        failed: [],
      };
    });

    const startManagedServerFn = vi.fn(async () => {
      calls.push("startup");
      return {
        attempted: true,
        pid: 222,
        command: "npm run dev",
        cwd: "/tmp/project",
        startedAt: "2026-03-16T00:00:00.000Z",
      };
    });

    const runHealthcheckFn = vi.fn(async () => {
      calls.push("healthcheck");
      return {
        attempted: true,
        passed: true,
        type: "http_ok",
        url: "http://127.0.0.1:3000/health",
        checkedAt: "2026-03-16T00:00:01.000Z",
        timeoutSec: 2,
        statusCode: 200,
      };
    });

    const result = await resetEnvironment({
      environment: {
        managed_processes: [{ command_contains: "server.js" }],
        startup: {
          command: "npm run dev",
          healthcheck: {
            type: "http_ok",
            url: "http://127.0.0.1:3000/health",
            timeoutSec: 2,
          },
        },
      },
      cwd: "/tmp/project",
      workspaceDir: "/tmp/workspace",
      stopManagedProcessesFn,
      cleanupRuntimeStateFn,
      startManagedServerFn,
      runHealthcheckFn,
    });

    expect(calls).toEqual(["stop", "cleanup", "startup", "healthcheck"]);

    expect(result).toEqual({
      attempted: true,
      stopSummary: {
        attempted: true,
        stopped: [{ pid: 111, command: "node server.js", mode: "graceful" }],
        failed: [],
      },
      cleanupSummary: {
        attempted: true,
        scopePaths: ["/tmp/project", "/tmp/workspace"],
        removed: ["/tmp/project/server.pid"],
        failed: [],
      },
      startupSummary: {
        attempted: true,
        pid: 222,
        command: "npm run dev",
        cwd: "/tmp/project",
        startedAt: "2026-03-16T00:00:00.000Z",
      },
      healthcheckSummary: {
        attempted: true,
        passed: true,
        type: "http_ok",
        url: "http://127.0.0.1:3000/health",
        checkedAt: "2026-03-16T00:00:01.000Z",
        timeoutSec: 2,
        statusCode: 200,
      },
    });
  });

  it("injects startup pid into process_alive healthcheck when pid is missing", async () => {
    const runHealthcheckFn = vi.fn(async ({ healthcheck }) => {
      return {
        attempted: true,
        passed: true,
        type: healthcheck.type,
        pid: healthcheck.pid,
        checkedAt: "2026-03-16T00:00:01.000Z",
        timeoutSec: healthcheck.timeoutSec,
      };
    });

    const result = await resetEnvironment({
      environment: {
        managed_processes: [],
        startup: {
          command: "npm run dev",
          healthcheck: {
            type: "process_alive",
            timeoutSec: 2,
          },
        },
      },
      cwd: "/tmp/project",
      workspaceDir: "/tmp/workspace",
      stopManagedProcessesFn: vi.fn(async () => ({
        attempted: false,
        stopped: [],
        failed: [],
      })),
      cleanupRuntimeStateFn: vi.fn(async () => ({
        attempted: true,
        scopePaths: ["/tmp/project", "/tmp/workspace"],
        removed: [],
        failed: [],
      })),
      startManagedServerFn: vi.fn(async () => ({
        attempted: true,
        pid: 333,
        command: "npm run dev",
        cwd: "/tmp/project",
        startedAt: "2026-03-16T00:00:00.000Z",
      })),
      runHealthcheckFn,
    });

    expect(runHealthcheckFn).toHaveBeenCalledTimes(1);
    expect(runHealthcheckFn).toHaveBeenCalledWith({
      healthcheck: {
        type: "process_alive",
        timeoutSec: 2,
        pid: 333,
      },
    });

    expect(result.healthcheckSummary).toEqual({
      attempted: true,
      passed: true,
      type: "process_alive",
      pid: 333,
      checkedAt: "2026-03-16T00:00:01.000Z",
      timeoutSec: 2,
    });
  });

  it("throws when healthcheck fails", async () => {
    await expect(
      resetEnvironment({
        environment: {
          managed_processes: [],
          startup: {
            command: "npm run dev",
            healthcheck: {
              type: "http_ok",
              url: "http://127.0.0.1:3000/health",
              timeoutSec: 1,
            },
          },
        },
        cwd: "/tmp/project",
        workspaceDir: "/tmp/workspace",
        stopManagedProcessesFn: vi.fn(async () => ({
          attempted: false,
          stopped: [],
          failed: [],
        })),
        cleanupRuntimeStateFn: vi.fn(async () => ({
          attempted: true,
          scopePaths: ["/tmp/project", "/tmp/workspace"],
          removed: [],
          failed: [],
        })),
        startManagedServerFn: vi.fn(async () => ({
          attempted: true,
          pid: 444,
          command: "npm run dev",
          cwd: "/tmp/project",
          startedAt: "2026-03-16T00:00:00.000Z",
        })),
        runHealthcheckFn: vi.fn(async () => ({
          attempted: true,
          passed: false,
          type: "http_ok",
          url: "http://127.0.0.1:3000/health",
          checkedAt: "2026-03-16T00:00:01.000Z",
          timeoutSec: 1,
          reason: "connection refused",
        })),
      })
    ).rejects.toMatchObject({
      message: "Environment reset healthcheck failed",
      code: "ENVIRONMENT_HEALTHCHECK_FAILED",
    });
  });

  it("skips healthcheck when no supported healthcheck policy is present", async () => {
    const runHealthcheckFn = vi.fn();

    const result = await resetEnvironment({
      environment: {
        managed_processes: [],
        startup: {
          command: "",
        },
      },
      cwd: "/tmp/project",
      workspaceDir: "/tmp/workspace",
      stopManagedProcessesFn: vi.fn(async () => ({
        attempted: false,
        stopped: [],
        failed: [],
      })),
      cleanupRuntimeStateFn: vi.fn(async () => ({
        attempted: true,
        scopePaths: ["/tmp/project", "/tmp/workspace"],
        removed: [],
        failed: [],
      })),
      startManagedServerFn: vi.fn(async () => ({
        attempted: false,
        pid: null,
        command: "",
        cwd: "/tmp/project",
        startedAt: "2026-03-16T00:00:00.000Z",
      })),
      runHealthcheckFn,
    });

    expect(runHealthcheckFn).not.toHaveBeenCalled();
    expect(result.healthcheckSummary).toEqual({
      attempted: false,
      passed: true,
      skipped: true,
    });
  });
});
