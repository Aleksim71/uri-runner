// path: test/unit/result-builder.test.mjs
import { describe, it, expect } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const {
  buildRuntimeResult,
  buildSuccessResult,
  buildFailureResult,
  normalizeRuntimeError,
  normalizeFileDeliveryReport,
} = require("../../src/runtime/result-builder.cjs");

describe("result-builder", () => {
  it("builds success result with defaults", () => {
    const result = buildSuccessResult({
      runId: "run_1",
      project: "demo",
      engine: "scenario",
      meta: {
        loadedCommands: ["system.echo"],
      },
    });

    expect(result).toMatchObject({
      runId: "run_1",
      project: "demo",
      engine: "scenario",
      ok: true,
      exitCode: 0,
      attempts: 1,
      loadedCommands: ["system.echo"],
      error: null,
    });
  });

  it("builds failure result and normalizes error", () => {
    const result = buildFailureResult(
      {
        runId: "run_2",
        project: "demo",
        engine: "scenario",
      },
      {
        code: "PLAN_SCHEMA_INVALID",
        message: "Invalid plan schema",
        details: { field: "steps" },
      }
    );

    expect(result.ok).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(result.error).toEqual({
      name: "Error",
      code: "PLAN_SCHEMA_INVALID",
      message: "Invalid plan schema",
      details: { field: "steps" },
    });
  });

  it("keeps explicit non-zero exit code", () => {
    const result = buildRuntimeResult({
      ok: false,
      exitCode: 7,
      error: { code: "BOOM", message: "boom" },
    });

    expect(result.exitCode).toBe(7);
  });

  it("normalizes scalar errors", () => {
    expect(normalizeRuntimeError("boom")).toEqual({
      name: "Error",
      code: "UNKNOWN_ERROR",
      message: "boom",
      details: {},
    });
  });

  it("normalizes file delivery report from outbox payload", () => {
    const result = buildRuntimeResult({
      runId: "run_3",
      outboxPayload: {
        fileDeliveryReport: {
          ok: false,
          error: {
            code: "REQUIRED_FILES_DELIVERY_FAILED",
            message: "delivery failed",
          },
          summary: {
            requested: 2,
            provided: 1,
            missing: 1,
            failed: 0,
          },
          requestedFiles: ["a.txt", "b.txt"],
          providedFiles: ["a.txt"],
          fileResults: [
            {
              requestedPath: "a.txt",
              status: "provided",
              providedPath: "provided/a.txt",
              error: null,
            },
            {
              requestedPath: "b.txt",
              status: "missing",
              providedPath: null,
              error: {
                code: "FILE_NOT_FOUND",
                message: "missing",
              },
            },
          ],
          projectTree: {
            attached: true,
            path: "provided/project-tree.txt",
          },
        },
      },
    });

    expect(result.fileDeliveryReport).toMatchObject({
      ok: false,
      error: {
        code: "REQUIRED_FILES_DELIVERY_FAILED",
      },
      summary: {
        requested: 2,
        provided: 1,
        missing: 1,
        failed: 0,
      },
      requestedFiles: ["a.txt", "b.txt"],
      providedFiles: ["a.txt"],
      projectTree: {
        attached: true,
        path: "provided/project-tree.txt",
      },
    });
  });

  it("normalizes standalone file delivery report", () => {
    expect(
      normalizeFileDeliveryReport({
        ok: true,
        error: null,
        summary: {
          requested: 1,
          provided: 1,
          missing: 0,
          failed: 0,
        },
        requestedFiles: ["report.txt"],
        providedFiles: ["report.txt"],
        fileResults: [
          {
            requestedPath: "report.txt",
            status: "provided",
            providedPath: "provided/report.txt",
            error: null,
          },
        ],
        projectTree: {
          attached: false,
          path: null,
        },
      })
    ).toMatchObject({
      ok: true,
      error: null,
      summary: {
        requested: 1,
        provided: 1,
        missing: 0,
        failed: 0,
      },
      requestedFiles: ["report.txt"],
      providedFiles: ["report.txt"],
      projectTree: {
        attached: false,
        path: null,
      },
    });
  });
});
