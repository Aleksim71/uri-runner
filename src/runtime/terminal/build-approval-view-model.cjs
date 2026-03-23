// src/runtime/terminal/build-approval-view-model.cjs
function normalizeText(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function formatCommand(program, args = []) {
  const safeProgram = normalizeText(program);
  const safeArgs = Array.isArray(args)
    ? args.map((item) => normalizeText(item)).filter(Boolean)
    : [];

  return [safeProgram, ...safeArgs].filter(Boolean).join(" ").trim();
}

function buildApprovalViewModel(step = {}) {
  const rationale = step.assistantRationale || {};
  const approval = step.approval || {};
  const saferAlternativeReview = step.saferAlternativeReview || {};

  return {
    state: "awaiting_approval",
    stepId: normalizeText(step.id),
    title: normalizeText(step.title),
    group: normalizeText(step.group),
    policyDecision: normalizeText(step.policyDecision || "ask"),
    riskLevel: normalizeText(approval.riskLevel || "unknown"),
    goal: normalizeText(rationale.goal),
    command: formatCommand(step.program, step.args),
    whyThisCommand: normalizeText(rationale.whyThisCommand),
    whyApprovalIsNeeded: normalizeText(rationale.whyApprovalIsNeeded),
    expectedOutcome: normalizeText(rationale.expectedOutcome),
    saferAlternativeSummary: normalizeText(saferAlternativeReview.selectedWhy),
  };
}

module.exports = {
  buildApprovalViewModel,
  formatCommand,
};
