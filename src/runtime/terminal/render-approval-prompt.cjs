// src/runtime/terminal/render-approval-prompt.cjs
function safe(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function appendSection(lines, label, value) {
  const text = safe(value);

  if (!text) {
    return;
  }

  lines.push(`${label}:`);
  lines.push(text);
  lines.push("");
}

function renderApprovalPrompt(viewModel = {}) {
  const lines = [
    "URI WATCH",
    "────────────────────────",
    `status: ${safe(viewModel.state) || "awaiting_approval"}`,
  ];

  if (safe(viewModel.stepId)) {
    lines.push(`step: ${safe(viewModel.stepId)}`);
  }

  if (safe(viewModel.title)) {
    lines.push(`title: ${safe(viewModel.title)}`);
  }

  if (safe(viewModel.group)) {
    lines.push(`group: ${safe(viewModel.group)}`);
  }

  if (safe(viewModel.policyDecision)) {
    lines.push(`decision: ${safe(viewModel.policyDecision)}`);
  }

  if (safe(viewModel.riskLevel)) {
    lines.push(`risk: ${safe(viewModel.riskLevel)}`);
  }

  lines.push("");

  appendSection(lines, "goal", viewModel.goal);
  appendSection(lines, "selected command", viewModel.command);
  appendSection(lines, "why this command", viewModel.whyThisCommand);
  appendSection(lines, "why approval is needed", viewModel.whyApprovalIsNeeded);
  appendSection(lines, "expected result", viewModel.expectedOutcome);
  appendSection(lines, "safer alternatives", viewModel.saferAlternativeSummary);

  lines.push("approve:");
  lines.push("[Y/Enter = yes] [N = no] [Q = abort]");

  return lines.join("\n");
}

module.exports = {
  renderApprovalPrompt,
};
