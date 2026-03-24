"use strict";

// path: test/uram/run-plan.browser.test.cjs

const path = require("node:path");
const { beforeEach, describe, expect, it, vi } = require("vitest");

const runBrowserDiagnostics = vi.fn();

vi.mock("../../src/runtime/browser/run-browser-diagnostics.cjs", () => ({
  runBrowserDiagnostics,
}));

describe("runPlan materialized browser step", () => {
  beforeEach(() => {
    runBrowserDiagnostics.mockReset();
  });

  it("executes browser diagnostics materialized step", async () => {
    const { runPlan } = require("../../src/uram/run-plan.cjs");

    runBrowserDiagnostics.mockResolvedValue({
      ok: true,
      summaryPath: path.resolve("runtime/browser/artifacts/summary.json"),
    });

    const result = await runPlan({
      projectRoot: process.cwd(),
      plan: {
        version: 1,
        kind: "materialized-plan",
        receiver: "uri",
        project: "uri-runner-next",
        goal: "run browser diagnostics",
        steps: [
          {
            stepId: "browser-step-1",
            type: "browser",
            action: "diagnostics.run",
            payload: {
              host: "127.0.0.1",
              port: 9222,
              target: "/",
              timeoutMs: 1000,
              artifactsDir: "runtime/browser/artifacts",
            },
          },
        ],
      },
    });

    expect(result.exitCode).toBe(0);
    expect(result.outboxPayload.ok).toBe(true);
    expect(result.outboxPayload.result.results).toHaveLength(1);
    expect(result.outboxPayload.result.results[0]).toMatchObject({
      stepId: "browser-step-1",
      type: "browser",
      action: "diagnostics.run",
      ok: true,
      value: {
        ok: true,
      },
    });
    expect(runBrowserDiagnostics).toHaveBeenCalledWith(
      {
        host: "127.0.0.1",
        port: 9222,
        target: "/",
        timeoutMs: 1000,
        artifactsDir: path.resolve("runtime/browser/artifacts"),
      },
      {}
    );
  });
});
