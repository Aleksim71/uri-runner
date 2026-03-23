// test/unit/run-watch-approval-step.test.mjs
import { describe, it, expect } from "vitest";
import { PassThrough } from "node:stream";
import { runWatchApprovalStep } from "../../src/runtime/terminal/run-watch-approval-step.cjs";

function createFakeIO(answer) {
  const input = new PassThrough();
  const output = new PassThrough();

  let printed = "";
  output.on("data", (chunk) => {
    printed += chunk.toString();
  });

  input.end(`${answer}\n`);

  return {
    input,
    output,
    getPrinted: () => printed,
  };
}

const step = {
  id: "step-09",
  title: "Run tests",
  group: "G2_SAFE_VALIDATION",
  policyDecision: "ask",
  program: "npm",
  args: ["test"],
  approval: {
    riskLevel: "medium",
  },
  assistantRationale: {
    goal: "Проверить, не сломали ли изменения текущий пайплайн",
    whyThisCommand: "npm test — штатная команда проекта для проверки тестов",
    whyApprovalIsNeeded: "Project scripts могут иметь побочные эффекты",
    expectedOutcome: "Либо зелёный тестовый прогон, либо диагностический вывод",
  },
  saferAlternativeReview: {
    selectedWhy: "Более безопасной альтернативы не найдено",
  },
};

describe("runWatchApprovalStep", () => {
  it("returns approved state for Enter/Y flow", async () => {
    const io = createFakeIO("y");
    const result = await runWatchApprovalStep(step, {
      input: io.input,
      output: io.output,
    });

    expect(result.stepId).toBe("step-09");
    expect(result.policyDecision).toBe("ask");
    expect(result.userDecision).toBe("approve");
    expect(result.watchState).toBe("approved");
    expect(io.getPrinted()).toContain("URI WATCH");
    expect(io.getPrinted()).toContain("approve:");
  });

  it("returns denied_by_user for N", async () => {
    const io = createFakeIO("n");
    const result = await runWatchApprovalStep(step, {
      input: io.input,
      output: io.output,
    });

    expect(result.userDecision).toBe("deny");
    expect(result.watchState).toBe("denied_by_user");
  });

  it("returns aborted_by_user for Q", async () => {
    const io = createFakeIO("q");
    const result = await runWatchApprovalStep(step, {
      input: io.input,
      output: io.output,
    });

    expect(result.userDecision).toBe("abort");
    expect(result.watchState).toBe("aborted_by_user");
  });
});
