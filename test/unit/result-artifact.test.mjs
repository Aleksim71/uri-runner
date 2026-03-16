import { describe, it, expect } from "vitest";
import {
  buildResultArtifact,
} from "../../src/uram/artifacts/result-artifact.cjs";
import {
  serializeError,
} from "../../src/uram/artifacts/error-utils.cjs";

describe("result artifact", () => {
  it("builds success artifact", () => {
    const artifact = buildResultArtifact({
      runId: "run_001",
      executionStatus: "success",
      startedAt: "2026-03-12T10:00:00.000Z",
      finishedAt: "2026-03-12T10:00:05.000Z",
      stepsTotal: 3,
      stepsCompleted: 3,
      failedStep: null,
      planWritten: true,
      traceWritten: false,
      artifactsProduced: true,
      error: null,
    });

    expect(artifact).toEqual({
      version: 1,
      runId: "run_001",
      executionStatus: "success",
      startedAt: "2026-03-12T10:00:00.000Z",
      finishedAt: "2026-03-12T10:00:05.000Z",
      durationMs: 5000,
      stepsTotal: 3,
      stepsCompleted: 3,
      failedStep: null,
      planWritten: true,
      traceWritten: false,
      artifactsProduced: true,
      error: null,
    });
  });

  it("serializes errors consistently", () => {
    const raw = new Error("boom");
    raw.code = "TEST_ERROR";

    expect(serializeError(raw)).toMatchObject({
      name: "Error",
      message: "boom",
      code: "TEST_ERROR",
    });
  });
});
