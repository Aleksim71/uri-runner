import { describe, it, expect } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const {
  buildRuntimeResult,
  buildSuccessResult,
  buildFailureResult,
  normalizeRuntimeError,
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
});
