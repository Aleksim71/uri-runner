"use strict";

// path: test/uram/execute-browser-diagnostics-step.test.cjs

const path = require("node:path");
const { beforeEach, describe, expect, it, vi } = require("vitest");

const runBrowserDiagnostics = vi.fn();

vi.mock("../../src/runtime/browser/run-browser-diagnostics.cjs", () => ({
  runBrowserDiagnostics,
}));

describe("executeBrowserDiagnosticsStep", () => {
  beforeEach(() => {
    runBrowserDiagnostics.mockReset();
  });

  it("uses workspace REPORT/browser when artifactsDir is not provided", async () => {
    const {
      executeBrowserDiagnosticsStep,
    } = require("../../src/uram/execute-browser-diagnostics-step.cjs");

    runBrowserDiagnostics.mockResolvedValue({
      status: "ok",
      normalizedResult: {
        summary: {
          targetUrl: "http://127.0.0.1:3000/",
          artifactCount: 1,
        },
      },
      writeResult: {
        status: "ok",
      },
    });

    const result = await executeBrowserDiagnosticsStep(
      {
        type: "browser",
        action: "diagnostics.run",
        payload: {
          host: "127.0.0.1",
          port: "9333",
          target: "/",
          timeoutMs: "2500",
        },
      },
      {
        workspaceDir: "/tmp/uri-workspace",
        projectRoot: "/tmp/uri-project",
      }
    );

    const expectedArtifactsDir = path.resolve("/tmp/uri-workspace", "REPORT", "browser");

    expect(result).toEqual({
      kind: "browser-step-result",
      status: "ok",
      summary: {
        targetUrl: "http://127.0.0.1:3000/",
        artifactCount: 1,
      },
      artifactsDir: expectedArtifactsDir,
      reportPath: path.join(expectedArtifactsDir, "browser-report.json"),
      writeResult: {
        status: "ok",
      },
    });

    expect(runBrowserDiagnostics).toHaveBeenCalledWith(
      {
        host: "127.0.0.1",
        port: 9333,
        target: "/",
        timeoutMs: 2500,
        artifactsDir: expectedArtifactsDir,
      },
      {
        artifactsDir: expectedArtifactsDir,
      }
    );
  });

  it("falls back to projectRoot REPORT/browser when workspaceDir is missing", async () => {
    const {
      executeBrowserDiagnosticsStep,
    } = require("../../src/uram/execute-browser-diagnostics-step.cjs");

    runBrowserDiagnostics.mockResolvedValue({
      status: "warning",
      normalizedResult: {
        summary: {
          targetUrl: "http://127.0.0.1:9222/",
          artifactCount: 3,
        },
      },
      writeResult: {
        status: "warning",
      },
    });

    const result = await executeBrowserDiagnosticsStep(
      {
        type: "browser",
        action: "diagnostics.run",
        payload: {
          host: "127.0.0.1",
          port: 9222,
        },
      },
      {
        projectRoot: "/tmp/uri-project",
      }
    );

    const expectedArtifactsDir = path.resolve("/tmp/uri-project", "REPORT", "browser");

    expect(result.artifactsDir).toBe(expectedArtifactsDir);
    expect(result.reportPath).toBe(
      path.join(expectedArtifactsDir, "browser-report.json")
    );
    expect(runBrowserDiagnostics).toHaveBeenCalledWith(
      {
        host: "127.0.0.1",
        port: 9222,
        timeoutMs: 10000,
        artifactsDir: expectedArtifactsDir,
      },
      {
        artifactsDir: expectedArtifactsDir,
      }
    );
  });

  it("respects explicit payload.artifactsDir", async () => {
    const {
      executeBrowserDiagnosticsStep,
    } = require("../../src/uram/execute-browser-diagnostics-step.cjs");

    runBrowserDiagnostics.mockResolvedValue({
      status: "ok",
      normalizedResult: {
        summary: {},
      },
      writeResult: {
        status: "ok",
      },
    });

    await executeBrowserDiagnosticsStep(
      {
        type: "browser",
        action: "diagnostics.run",
        payload: {
          artifactsDir: "runtime/custom-browser",
        },
      },
      {
        workspaceDir: "/tmp/uri-workspace",
        projectRoot: "/tmp/uri-project",
      }
    );

    const expectedArtifactsDir = path.resolve("runtime/custom-browser");

    expect(runBrowserDiagnostics).toHaveBeenCalledWith(
      {
        host: "127.0.0.1",
        port: 9222,
        timeoutMs: 10000,
        artifactsDir: expectedArtifactsDir,
      },
      {
        artifactsDir: expectedArtifactsDir,
      }
    );
  });
});
