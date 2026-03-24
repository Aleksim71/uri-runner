"use strict";

// path: test/uram/run-plan.browser-artifacts.test.cjs

const path = require("node:path");
const { beforeEach, describe, expect, it, vi } = require("vitest");

const runBrowserDiagnostics = vi.fn();

vi.mock("../../src/runtime/browser/run-browser-diagnostics.cjs", () => ({
  runBrowserDiagnostics,
}));

describe("runPlan browser artifacts integration", () => {
  beforeEach(() => {
    runBrowserDiagnostics.mockReset();
  });

  it("returns browser artifacts paths in materialized plan results", async () => {
    const { runPlan } = require("../../src/uram/run-plan.cjs");

    runBrowserDiagnostics.mockResolvedValue({
      status: "ok",
      normalizedResult: {
        summary: {
          targetUrl: "http://127.0.0.1:9222/",
          artifactCount: 5,
        },
      },
      writeResult: {
        status: "ok",
        written: [
          {
            name: "browser-report.json",
            path: "/tmp/uri-workspace/REPORT/browser/browser-report.json",
          },
        ],
        manifest: {
          artifactCount: 5,
          baseDir: "/tmp/uri-workspace/REPORT/browser",
        },
        warnings: [],
        error: null,
      },
    });

    const result = await runPlan({
      projectRoot: "/tmp/uri-project",
      workspaceDir: "/tmp/uri-workspace",
      plan: {
        version: 1,
        kind: "materialized-plan",
        receiver: "uri",
        project: "uri-runner-next",
        goal: "Collect browser diagnostics",
        steps: [
          {
            type: "browser",
            action: "diagnostics.run",
            payload: {
              host: "127.0.0.1",
              port: 9222,
            },
          },
        ],
      },
    });

    expect(result.exitCode).toBe(0);
    expect(result.outboxPayload.ok).toBe(true);
    expect(result.outboxPayload.result.results).toHaveLength(1);
    expect(result.outboxPayload.result.results[0]).toMatchObject({
      type: "browser",
      action: "diagnostics.run",
      ok: true,
      value: {
        kind: "browser-step-result",
        status: "ok",
        artifactsDir: path.resolve("/tmp/uri-workspace", "REPORT", "browser"),
        reportPath: path.resolve(
          "/tmp/uri-workspace",
          "REPORT",
          "browser",
          "browser-report.json"
        ),
        summary: {
          targetUrl: "http://127.0.0.1:9222/",
          artifactCount: 5,
        },
      },
    });
  });
});
