import { describe, it, expect } from "vitest";
import {
  deriveFinalRunStatus,
  computeSafeToContinue,
  buildFinalFlags,
} from "../../src/uram/runtime-summary.cjs";

describe("runtime summary", () => {
  it("derives success when execution restore and verify are green", () => {
    expect(
      deriveFinalRunStatus({
        executionStatus: "success",
        rollbackStatus: "restored",
        verifyStatus: "verified",
      })
    ).toBe("success");
  });

  it("derives failed_restored when execution failed but baseline is restored", () => {
    expect(
      deriveFinalRunStatus({
        executionStatus: "failed",
        rollbackStatus: "restored",
        verifyStatus: "verified",
      })
    ).toBe("failed_restored");
  });

  it("derives unsafe when rollback is not restored", () => {
    expect(
      deriveFinalRunStatus({
        executionStatus: "success",
        rollbackStatus: "failed",
        verifyStatus: "verified",
      })
    ).toBe("unsafe");
  });

  it("computes safeToContinue only for success-like final states", () => {
    expect(computeSafeToContinue({ finalStatus: "success" })).toBe(true);
    expect(computeSafeToContinue({ finalStatus: "failed_restored" })).toBe(true);
    expect(computeSafeToContinue({ finalStatus: "unsafe" })).toBe(false);
  });

  it("builds final flags from rollback and verify artifacts", () => {
    expect(
      buildFinalFlags({
        rollbackResult: { rollbackStatus: "restored" },
        baselineVerifyResult: { verifyStatus: "verified" },
      })
    ).toEqual({
      baselineRestored: true,
      baselineVerified: true,
    });
  });
});
