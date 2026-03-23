// test/unit/run-approval-loop.test.mjs
import { describe, it, expect } from "vitest";
import { runApprovalLoop } from "../../src/runtime/terminal/run-approval-loop.cjs";

const step = {
  id: "s1",
  title: "Run tests",
  group: "G2",
  policyDecision: "ask",
  program: "npm",
  args: ["test"],
  approval: { riskLevel: "medium" },
  assistantRationale: {
    goal: "Проверить тесты",
    whyThisCommand: "Стандартная команда",
    whyApprovalIsNeeded: "Могут быть side-effects",
    expectedOutcome: "Результаты тестов",
  },
  saferAlternativeReview: { selectedWhy: "Нет альтернатив" },
};

describe("runApprovalLoop", () => {
  it("stays awaiting if no inputs", () => {
    const res = runApprovalLoop(step, []);
    expect(res.finalState).toBe("awaiting_approval");
    expect(res.history.length).toBe(1);
  });

  it("approves on y", () => {
    const res = runApprovalLoop(step, ["y"]);
    expect(res.finalState).toBe("approved");
  });

  it("denies on n", () => {
    const res = runApprovalLoop(step, ["n"]);
    expect(res.finalState).toBe("denied_by_user");
  });

  it("aborts on q", () => {
    const res = runApprovalLoop(step, ["q"]);
    expect(res.finalState).toBe("aborted_by_user");
  });

  it("handles invalid then approve", () => {
    const res = runApprovalLoop(step, ["zzz", "y"]);
    expect(res.finalState).toBe("approved");
    expect(res.history.length).toBe(3);
  });
});
