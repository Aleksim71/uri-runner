// test/unit/run-approval-stdin.mock.test.mjs

import { describe, it, expect } from "vitest";
import { createApprovalFlowState } from "../../src/runtime/terminal/create-approval-flow-state.cjs";

/**
 * Мы не тестируем реальный stdin (это e2e),
 * а проверяем поведение через createApprovalFlowState.
 */

describe("stdin flow (mocked)", () => {
  const step = {
    id: "s1",
    title: "Run tests",
    policyDecision: "ask",
    program: "npm",
    args: ["test"],
  };

  it("approve path", () => {
    const res = createApprovalFlowState(step, "y");
    expect(res.nextState).toBe("approved");
  });

  it("deny path", () => {
    const res = createApprovalFlowState(step, "n");
    expect(res.nextState).toBe("denied_by_user");
  });

  it("abort path", () => {
    const res = createApprovalFlowState(step, "q");
    expect(res.nextState).toBe("aborted_by_user");
  });
});
