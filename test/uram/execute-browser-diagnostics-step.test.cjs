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

  it("normalizes payload and calls browser runtime", async () => {
    const {
      executeBrowserDiagnosticsStep,
    } = require("../../src/uram/execute-browser-diagnostics-step.cjs");

    runBrowserDiagnostics.mockResolvedValue({ ok: true });

    const result = await executeBrowserDiagnosticsStep({
      type: "browser",
      action: "diagnostics.run",
      payload: {
        host: "127.0.0.1",
        port: "9333",
        target: "/",
        timeoutMs: "2500",
        artifactsDir: "runtime/custom-browser",
      },
    });

    expect(result).toEqual({ ok: true });
    expect(runBrowserDiagnostics).toHaveBeenCalledWith(
      {
        host: "127.0.0.1",
        port: 9333,
        target: "/",
        timeoutMs: 2500,
        artifactsDir: path.resolve("runtime/custom-browser"),
      },
      {}
    );
  });
});
