"use strict";

const path = require("path");

const { readRunbookFromInboxZip } = require("../../uram/runbook.cjs");
const { resolveProjectContext } = require("../../uram/project-resolver.cjs");
const { loadExecutableContext } = require("../../uram/executable-context.cjs");
const { compilePlan } = require("../../uram/compile-plan.cjs");
const { compileRunbookObject } = require("../../runtime/compile-runbook.cjs");

function normalizeArgs(input) {
  const defaultUramRoot = process.env.URI_URAM || process.cwd();

  if (input && typeof input === "object" && !Array.isArray(input)) {
    return {
      uramRoot: input.uramRoot || defaultUramRoot,
      inboxZipPath: input.inboxZipPath,
    };
  }

  return {
    uramRoot: defaultUramRoot,
    inboxZipPath: input,
  };
}

function isMaterializedRunbook(runbook) {
  return (
    runbook &&
    runbook.receiver === "uri" &&
    (Array.isArray(runbook.provide) ||
      Array.isArray(runbook.modify) ||
      Array.isArray(runbook.goal_checks))
  );
}

async function debugRunbook(input) {
  const { uramRoot, inboxZipPath } = normalizeArgs(input);

  const { runbook } = await readRunbookFromInboxZip(inboxZipPath);

  if (!runbook || typeof runbook !== "object") {
    throw new Error("[uri] failed to read runbook");
  }

  const project = runbook.project;
  if (!project) {
    throw new Error("[uri] runbook missing project field");
  }

  let plan;

  if (isMaterializedRunbook(runbook)) {
    plan = compileRunbookObject(runbook, { source: "RUNBOOK.yaml" });
  } else {
    const projectCtx = await resolveProjectContext({
      uramRoot,
      project,
      cwd: path.dirname(path.resolve(inboxZipPath)),
    });

    let executableCtx = null;

    try {
      executableCtx = await loadExecutableContext(projectCtx);
    } catch {
      executableCtx = null;
    }

    plan = compilePlan({
      runbook,
      project,
      executionKind: "scenario",
      executableCtx,
    });
  }

  const lines = [];
  const steps = Array.isArray(plan.steps) ? plan.steps : [];
  const stepIds = steps.map((step) => step && step.stepId).filter(Boolean);
  const commands = Array.from(
    new Set(
      steps
        .map((step) => step && step.command)
        .filter((value) => typeof value === "string" && value.trim().length > 0)
    )
  );
  const runtime =
    plan && plan.runtime && typeof plan.runtime === "object" ? plan.runtime : {};

  lines.push("RUNBOOK");
  lines.push("────────");
  lines.push(`version: ${runbook.version ?? 1}`);
  lines.push(`project: ${runbook.project || "(missing)"}`);
  lines.push(`receiver: ${runbook.receiver || "(missing)"}`);
  lines.push(`steps: ${steps.length}`);
  lines.push("");
  lines.push("PLAN");
  lines.push("────────");
  lines.push(`kind: ${plan.kind || "(unknown)"}`);
  lines.push(`steps: ${steps.length}`);
  lines.push("stepIds:");
  for (const stepId of stepIds) {
    lines.push(`- ${stepId}`);
  }
  for (let i = 0; i < steps.length; i += 1) {
    const step = steps[i] || {};
    const command =
      typeof step.command === "string" && step.command.trim()
        ? step.command
        : `${step.type || "(no-type)"}.${step.action || "(no-action)"}`;

    lines.push(`${i}. ${step.stepId || "(no-id)"} -> ${command}`);
  }
  lines.push("commands:");
  for (const command of commands) {
    lines.push(`- ${command}`);
  }

  lines.push("");
  lines.push("COMPILE SUMMARY");
  lines.push("───────────────");
  lines.push(`runbook.steps: ${Array.isArray(runbook.steps) ? runbook.steps.length : 0}`);
  lines.push(`plan.steps: ${steps.length}`);
  lines.push(`plan.engine: ${plan.engine || "scenario"}`);
  lines.push(`plan.project: ${plan.project || project}`);
  lines.push(
    `plan.runtime.strictCommands: ${
      runtime.strictCommands === true ? "true" : "false"
    }`
  );
  lines.push(
    `plan.runtime.maxSteps: ${
      Number.isFinite(runtime.maxSteps) ? runtime.maxSteps : "null"
    }`
  );

  console.log(lines.join("\n"));
}

module.exports = debugRunbook;
module.exports.debugRunbook = debugRunbook;
