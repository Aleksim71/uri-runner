// test/unit/create-approval-flow-state.test.mjs

import { describe, it, expect } from "vitest";
import { createApprovalFlowState } from "../../src/runtime/terminal/create-approval-flow-state.cjs";

const baseStep = {
  id: "step-01",
  title: "Run tests",
  group: "G2_SAFE_VALIDATION",
  policyDecision: "ask",
  program: "npm",
  args: ["test"],
  approval: { riskLevel: "medium" },
  assistantRationale: {
    goal: "Проверить тесты",
    whyThisCommand: "Стандартная команда проекта",
    whyApprovalIsNeeded: "Может запускать scripts",
    expectedOutcome: "Результаты тестов",
  },
  saferAlternativeReview: {
    selectedWhy: "Нет более безопасной альтернативы",
  },
};

describe("createApprovalFlowState", () => {
  it("returns awaiting state when no input provided", () => {
    const result = createApprovalFlowState(baseStep);

    expect(result.nextState).toBe("awaiting_approval");
    expect(result.decision).toBe("invalid");
    expect(result.prompt).toContain("URI WATCH");
  });

  it("handles approve", () => {
    const result = createApprovalFlowState(baseStep, "y");

    expect(result.decision).toBe("approve");
    expect(result.nextState).toBe("approved");
  });

  it("handles deny", () => {
    const result = createApprovalFlowState(baseStep, "n");

    expect(result.decision).toBe("deny");
    expect(result.nextState).toBe("denied_by_user");
  });

  it("handles abort", () => {
    const result = createApprovalFlowState(baseStep, "q");

    expect(result.decision).toBe("abort");
    expect(result.nextState).toBe("aborted_by_user");
  });

  it("keeps awaiting on invalid input", () => {
    const result = createApprovalFlowState(baseStep, "zzz");

    expect(result.decision).toBe("invalid");
    expect(result.nextState).toBe("awaiting_approval");
  });
});
