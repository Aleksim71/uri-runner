"use strict";

const fs = require("fs/promises");
const path = require("path");

const { readRunbookFromInboxZip } = require("../../uram/runbook.cjs");
const { resolveProjectContext } = require("../../uram/project-resolver.cjs");
const { loadExecutableContext } = require("../../uram/executable-context.cjs");
const { compilePlan } = require("../../uram/compile-plan.cjs");
const { compileRunbookObject } = require("../../runtime/compile-runbook.cjs");
const { createInvalidInboxHelpOutbox, resolveOutboxDir } = require("../lib/piligrim-support.cjs");

function isMaterializedRunbook(runbook) {
  return (
    runbook &&
    runbook.receiver === "uri" &&
    (
      Array.isArray(runbook.provide) ||
      Array.isArray(runbook.modify) ||
      Array.isArray(runbook.goal_checks)
    )
  );
}

async function compileInboxToPlan(input, maybeOutputPlanPath) {
  let inboxZipPath;
  let outputPlanPath;
  let uramRoot = process.cwd();

  if (input && typeof input === "object" && !Array.isArray(input)) {
    inboxZipPath = input.inboxZipPath;
    outputPlanPath = input.outputPlanPath;
    uramRoot = input.uramRoot || uramRoot;
  } else {
    inboxZipPath = input;
    outputPlanPath = maybeOutputPlanPath;
  }

  if (!inboxZipPath || !outputPlanPath) {
    throw new Error("compile requires <inbox.zip> <output-plan.json>");
  }

  let runbook;
  let project = "unknown";
  let plan;

  try {
    ({ runbook } = await readRunbookFromInboxZip(inboxZipPath));

    project = runbook?.project || "unknown";
    if (!runbook?.project) {
      throw new Error("[uri] runbook missing project field");
    }

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
  } catch (error) {
    const outboxZipPath = path.join(resolveOutboxDir(), "outbox.zip");

    await createInvalidInboxHelpOutbox({
      outboxZipPath,
      projectName: project || "tempasi",
      validation: {
        code: "compile_invalid_inbox",
        message: error?.message || "Inbox validation failed during compile",
        details: {
          inboxZipPath: path.resolve(inboxZipPath),
        },
      },
    });

    console.error(`[uri] compile failed: ${error?.message || String(error)}`);
    console.error(`[uri] help outbox: ${outboxZipPath}`);
    throw error;
  }

  const absOutputPath = path.resolve(outputPlanPath);
  await fs.mkdir(path.dirname(absOutputPath), { recursive: true });
  const payload = JSON.stringify(plan, null, 2);
  await fs.writeFile(absOutputPath, payload, "utf8");

  const bytes = Buffer.byteLength(payload, "utf8");

  console.log(`[uri] plan written: ${absOutputPath}`);
  console.log(`[uri] bytes: ${bytes}`);

  return {
    ok: true,
    project,
    planPath: absOutputPath,
    bytes,
  };
}

module.exports = compileInboxToPlan;
module.exports.compileInboxToPlan = compileInboxToPlan;
