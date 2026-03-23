// test/unit/handle-watch-step-policy.test.mjs
import { describe, it, expect } from "vitest";
import { PassThrough } from "node:stream";
import { handleWatchStepPolicy } from "../../src/runtime/terminal/handle-watch-step-policy.cjs";

function createFakeIO(answer) {
  const input = new PassThrough();
  const output = new PassThrough();

  let printed = "";
  output.on("data", (chunk) => {
    printed += chunk.toString();
  });

  if (answer !== undefined) {
    input.end(`${answer}\n`);
  }

  return {
    input,
    output,
    getPrinted: () => printed,
  };
}

const askStep = {
  id: "step-10",
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

describe("handleWatchStepPolicy", () => {
  it("returns auto branch result without prompt", async () => {
    const result = await handleWatchStepPolicy({
      id: "auto-01",
      policyDecision: "auto",
    });

    expect(result).toEqual({
      stepId: "auto-01",
      policyDecision: "auto",
      watchState: "auto_approved",
      userDecision: "auto",
      shouldExecute: false,
      blocked: false,
      prompt: "",
    });
  });

  it("returns deny branch result without prompt", async () => {
    const result = await handleWatchStepPolicy({
      id: "deny-01",
      policyDecision: "deny",
    });

    expect(result).toEqual({
      stepId: "deny-01",
      policyDecision: "deny",
      watchState: "blocked_by_policy",
      userDecision: "denied_by_policy",
      shouldExecute: false,
      blocked: true,
      prompt: "",
    });
  });

  it("routes ask branch through watcher approval", async () => {
    const io = createFakeIO("y");
    const result = await handleWatchStepPolicy(askStep, {
      input: io.input,
      output: io.output,
    });

    expect(result.stepId).toBe("step-10");
    expect(result.policyDecision).toBe("ask");
    expect(result.userDecision).toBe("approve");
    expect(result.watchState).toBe("approved");
    expect(result.shouldExecute).toBe(true);
    expect(result.blocked).toBe(false);
    expect(io.getPrinted()).toContain("URI WATCH");
  });

  it("marks denied_by_user as blocked", async () => {
    const io = createFakeIO("n");
    const result = await handleWatchStepPolicy(askStep, {
      input: io.input,
      output: io.output,
    });

    expect(result.userDecision).toBe("deny");
    expect(result.watchState).toBe("denied_by_user");
    expect(result.shouldExecute).toBe(false);
    expect(result.blocked).toBe(true);
  });
});
