// src/runtime/terminal/run-watch-approval-step.cjs
const { runApprovalWithStdin } = require("./run-approval-stdin.cjs");

async function runWatchApprovalStep(step = {}, options = {}) {
  const result = await runApprovalWithStdin(step, options);

  return {
    stepId: step.id || "",
    policyDecision: step.policyDecision || "ask",
    userDecision: result.decision,
    watchState: result.nextState,
    prompt: result.prompt,
  };
}

module.exports = {
  runWatchApprovalStep,
};
