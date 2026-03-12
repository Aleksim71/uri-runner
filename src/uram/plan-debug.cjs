"use strict";

const { assertPlanShape } = require("./plan-schema.cjs");

function summarizePlan(plan) {
  const normalized = assertPlanShape(plan);

  const commands = normalized.steps.map((s) => s.command);

  const roots = Array.from(
    new Set(normalized.steps.map((s) => s.commandRoot))
  );

  return {
    engine: normalized.engine,
    project: normalized.project,
    stepsCount: normalized.steps.length,
    commands,
    roots,
    runtime: {
      strictCommands: normalized.runtime.strictCommands === true,
      maxSteps:
        normalized.runtime.maxSteps === undefined
          ? null
          : normalized.runtime.maxSteps,
    },
  };
}

function formatPlan(plan) {
  const normalized = assertPlanShape(plan);

  const lines = [];

  lines.push("PLAN");
  lines.push("────");

  lines.push(`engine: ${normalized.engine}`);
  lines.push(`project: ${normalized.project}`);
  lines.push(`steps: ${normalized.steps.length}`);

  lines.push("");

  lines.push("runtime:");
  lines.push(
    `  strictCommands: ${normalized.runtime.strictCommands ? "true" : "false"}`
  );

  lines.push(
    `  maxSteps: ${
      normalized.runtime.maxSteps === null
        ? "null"
        : normalized.runtime.maxSteps
    }`
  );

  lines.push("");

  lines.push("steps:");
  normalized.steps.forEach((step) => {
    lines.push(
      `  ${step.index}. ${step.stepId} -> ${step.command}`
    );
  });

  return lines.join("\n");
}

function printPlan(plan) {
  const formatted = formatPlan(plan);
  console.log(formatted);
}

module.exports = {
  summarizePlan,
  formatPlan,
  printPlan,
};
