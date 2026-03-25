// src/runtime/terminal/handle-watch-step-policy.cjs
const { runWatchApprovalStep } = require("./run-watch-approval-step.cjs");

const POLICY_MODES = new Set(["strict", "safe", "full"]);

function normalizePolicyMode(step = {}) {
  const value =
    typeof step.policyMode === "string" && step.policyMode.trim().length > 0
      ? step.policyMode.trim()
      : "safe";

  return POLICY_MODES.has(value) ? value : "safe";
}

function resolvePolicyDecision(step = {}) {
  if (typeof step.policyDecision === "string" && step.policyDecision.trim().length > 0) {
    return step.policyDecision.trim();
  }

  const policyMode = normalizePolicyMode(step);

  if (policyMode === "full") {
    return "auto";
  }

  return "ask";
}

/**
 * Narrow branch adapter for watcher/runtime.
 * This helper is additive only.
 * It does not modify watcher entrypoints and does not execute commands.
 */
async function handleWatchStepPolicy(step = {}, options = {}) {
  const policyMode = normalizePolicyMode(step);
  const policyDecision = resolvePolicyDecision(step);

  if (policyDecision === "auto") {
    return {
      stepId: step.id || "",
      policyMode,
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
      policyMode,
      policyDecision,
      watchState: "blocked_by_policy",
      userDecision: "denied_by_policy",
      shouldExecute: false,
      blocked: true,
      prompt: "",
    };
  }

  const approvalResult = await runWatchApprovalStep(
    {
      ...step,
      policyMode,
      policyDecision,
    },
    options
  );

  return {
    stepId: approvalResult.stepId,
    policyMode,
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
  normalizePolicyMode,
  resolvePolicyDecision,
};
