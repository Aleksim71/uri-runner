// src/runtime/terminal/create-approval-flow-state.cjs
const { buildApprovalViewModel } = require("./build-approval-view-model.cjs");
const { renderApprovalPrompt } = require("./render-approval-prompt.cjs");
const { normalizeApprovalInput } = require("./normalize-approval-input.cjs");

function createApprovalFlowState(step = {}, rawInput = undefined) {
  const viewModel = buildApprovalViewModel(step);
  const prompt = renderApprovalPrompt(viewModel);

  if (rawInput === undefined) {
    return {
      prompt,
      decision: "invalid",
      nextState: "awaiting_approval",
    };
  }

  const decision = normalizeApprovalInput(rawInput);

  if (decision === "approve") {
    return {
      prompt,
      decision,
      nextState: "approved",
    };
  }

  if (decision === "deny") {
    return {
      prompt,
      decision,
      nextState: "denied_by_user",
    };
  }

  if (decision === "abort") {
    return {
      prompt,
      decision,
      nextState: "aborted_by_user",
    };
  }

  return {
    prompt,
    decision: "invalid",
    nextState: "awaiting_approval",
  };
}

module.exports = {
  createApprovalFlowState,
};
