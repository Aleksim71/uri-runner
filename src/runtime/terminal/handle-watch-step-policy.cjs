// src/runtime/terminal/handle-watch-step-policy.cjs
const { runWatchApprovalStep } = require("./run-watch-approval-step.cjs");

/**
 * Narrow branch adapter for watcher/runtime.
 * This helper is additive only.
 * It does not modify watcher entrypoints and does not execute commands.
 */
async function handleWatchStepPolicy(step = {}, options = {}) {
  const policyDecision = step.policyDecision || "ask";

  if (policyDecision === "auto") {
    return {
      stepId: step.id || "",
      policyDecision,
      watchState: "auto_approved",
      userDecision: "auto",
      shouldExecute: false,
      blocked: false,
      prompt: "",
    };
  }

  if (policyDecision === "deny") {
    return {
      stepId: step.id || "",
      policyDecision,
      watchState: "blocked_by_policy",
      userDecision: "denied_by_policy",
      shouldExecute: false,
      blocked: true,
      prompt: "",
    };
  }

  const approvalResult = await runWatchApprovalStep(step, options);

  return {
    stepId: approvalResult.stepId,
    policyDecision: approvalResult.policyDecision,
    watchState: approvalResult.watchState,
    userDecision: approvalResult.userDecision,
    shouldExecute: approvalResult.watchState === "approved",
    blocked: approvalResult.watchState !== "approved",
    prompt: approvalResult.prompt,
  };
}

module.exports = {
  handleWatchStepPolicy,
};
