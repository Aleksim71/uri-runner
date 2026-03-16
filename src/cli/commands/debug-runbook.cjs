"use strict";

const { readRunbookFromInboxZip } = require("../../uram/runbook.cjs");
const { resolveProjectContext } = require("../../uram/project-resolver.cjs");
const { loadExecutableContext } = require("../../uram/executable-context.cjs");
const { compilePlan } = require("../../uram/compile-plan.cjs");
const { summarizePlan, formatPlan } = require("../../uram/plan-debug.cjs");

function summarizeRunbook(runbook) {
  const steps = Array.isArray(runbook?.steps) ? runbook.steps : [];

  return {
    version: runbook?.version ?? null,
    project: runbook?.project ?? null,
    stepsCount: steps.length,
    commands: steps
      .map((step) => step?.command)
      .filter((value) => typeof value === "string" && value.trim().length > 0),
    stepIds: steps
      .map((step) => step?.id)
      .filter((value) => typeof value === "string" && value.trim().length > 0),
  };
}

function formatRunbookSummary(runbook) {
  const summary = summarizeRunbook(runbook);
  const lines = [];

  lines.push("RUNBOOK");
  lines.push("───────");
  lines.push(`version: ${summary.version === null ? "null" : summary.version}`);
  lines.push(`project: ${summary.project === null ? "null" : summary.project}`);
  lines.push(`steps: ${summary.stepsCount}`);

  lines.push("");
  lines.push("stepIds:");
  if (summary.stepIds.length === 0) {
    lines.push("  (empty)");
  } else {
    for (const stepId of summary.stepIds) {
      lines.push(`  - ${stepId}`);
    }
  }

  lines.push("");
  lines.push("commands:");
  if (summary.commands.length === 0) {
    lines.push("  (empty)");
  } else {
    for (const command of summary.commands) {
      lines.push(`  - ${command}`);
    }
  }

  return lines.join("\n");
}

function formatComparison(runbook, plan) {
  const runbookSummary = summarizeRunbook(runbook);
  const planSummary = summarizePlan(plan);

  const lines = [];
  lines.push("COMPILE SUMMARY");
  lines.push("───────────────");
  lines.push(`runbook.steps: ${runbookSummary.stepsCount}`);
  lines.push(`plan.steps: ${planSummary.stepsCount}`);
  lines.push(`plan.engine: ${planSummary.engine}`);
  lines.push(`plan.project: ${planSummary.project}`);
  lines.push(
    `plan.runtime.strictCommands: ${planSummary.runtime.strictCommands ? "true" : "false"}`
  );
  lines.push(
    `plan.runtime.maxSteps: ${
      planSummary.runtime.maxSteps === null
        ? "null"
        : planSummary.runtime.maxSteps
    }`
  );

  return lines.join("\n");
}

function normalizeArgs(input) {
  if (input && typeof input === "object" && !Array.isArray(input)) {
    return {
      uramRoot: input.uramRoot || process.cwd(),
      inboxZipPath: input.inboxZipPath,
    };
  }

  return {
    uramRoot: process.cwd(),
    inboxZipPath: input,
  };
}

async function debugRunbook(input) {
  const { uramRoot, inboxZipPath } = normalizeArgs(input);

  const { runbook } = await readRunbookFromInboxZip(inboxZipPath);

  const project = runbook?.project;
  if (!project) {
    throw new Error("[uri] runbook missing project field");
  }

  const projectCtx = await resolveProjectContext({
    uramRoot,
    project,
  });

  const executableCtx = await loadExecutableContext(projectCtx);

  const plan = compilePlan({
    runbook,
    project,
    executionKind: "scenario",
    executableCtx,
  });

  console.log(formatRunbookSummary(runbook));
  console.log("");
  console.log(formatComparison(runbook, plan));
  console.log("");
  console.log(formatPlan(plan));
}

module.exports = {
  summarizeRunbook,
  formatRunbookSummary,
  formatComparison,
  debugRunbook,
};
