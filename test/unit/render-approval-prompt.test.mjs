// test/unit/render-approval-prompt.test.mjs

import { describe, it, expect } from "vitest";
import { renderApprovalPrompt } from "../../src/runtime/terminal/render-approval-prompt.cjs";

describe("renderApprovalPrompt", () => {
  it("renders the full watcher approval block", () => {
    const output = renderApprovalPrompt({
      state: "awaiting_approval",
      stepId: "step-03",
      title: "Run tests",
      group: "G2_SAFE_VALIDATION",
      policyDecision: "ask",
      riskLevel: "medium",
      goal: "Проверить, не сломали ли изменения текущий пайплайн",
      command: "npm test",
      whyThisCommand: "npm test — штатная команда проекта для проверки тестов",
      whyApprovalIsNeeded: "Project scripts могут иметь побочные эффекты",
      expectedOutcome: "Либо зелёный тестовый прогон, либо диагностический вывод",
      saferAlternativeSummary: "Более безопасной альтернативы не найдено",
    });

    expect(output).toContain("URI WATCH");
    expect(output).toContain("status: awaiting_approval");
    expect(output).toContain("step: step-03");
    expect(output).toContain("title: Run tests");
    expect(output).toContain("group: G2_SAFE_VALIDATION");
    expect(output).toContain("decision: ask");
    expect(output).toContain("risk: medium");
    expect(output).toContain("goal:\nПроверить, не сломали ли изменения текущий пайплайн");
    expect(output).toContain("selected command:\nnpm test");
    expect(output).toContain("why this command:\nnpm test — штатная команда проекта для проверки тестов");
    expect(output).toContain("why approval is needed:\nProject scripts могут иметь побочные эффекты");
    expect(output).toContain("expected result:\nЛибо зелёный тестовый прогон, либо диагностический вывод");
    expect(output).toContain("safer alternatives:\nБолее безопасной альтернативы не найдено");
    expect(output).toContain("[Y/Enter = yes] [N = no] [Q = abort]");
  });

  it("omits empty sections and keeps the footer", () => {
    const output = renderApprovalPrompt({
      state: "awaiting_approval",
      policyDecision: "ask",
      riskLevel: "unknown",
    });

    expect(output).toContain("status: awaiting_approval");
    expect(output).toContain("decision: ask");
    expect(output).toContain("risk: unknown");
    expect(output).not.toContain("goal:");
    expect(output).not.toContain("selected command:");
    expect(output).toContain("approve:");
    expect(output).toContain("[Y/Enter = yes] [N = no] [Q = abort]");
  });
});
