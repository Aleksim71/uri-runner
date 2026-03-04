#!/usr/bin/env node
/* eslint-disable no-console */

const { Command } = require("commander");
const path = require("path");

const { runAudit } = require("./lib/audit.cjs");

const program = new Command();

program
  .name("uri")
  .description("URI Runner (minimal skeleton)")
  .version("0.0.0");

function addCommonOptions(cmd) {
  return cmd
    .argument("[inbox]", "Path to inbox.zip (optional positional)")
    .option("--inbox <path>", "Path to inbox.zip", "artifacts/inbox/inbox.zip")
    .option("--outbox <path>", "Path to outbox.zip", "artifacts/outbox/outbox.zip")
    .option("--workspace <path>", "Workspace dir", ".runner-work")
    .option("--quiet", "No console output", false);
}

/* ----------------------------- AUDIT ----------------------------- */

addCommonOptions(
  program
    .command("audit", { isDefault: true })
    .description("Run audit pipeline (read-only minimal skeleton)")
).action(async (inboxArg, opts) => {
  try {
    const inbox = inboxArg || opts.inbox;

    if (!opts.quiet) {
      console.log(`[uri] audit: inbox=${inbox}`);
    }

    const res = await runAudit({
      cwd: process.cwd(),
      inboxPath: path.resolve(process.cwd(), inbox),
      outboxPath: path.resolve(process.cwd(), opts.outbox),
      workspaceDir: path.resolve(process.cwd(), opts.workspace),
    });

    if (!opts.quiet) {
      console.log(`[uri] audit: exitCode=${res.exitCode}, outbox=${opts.outbox}`);
    }

    process.exit(res.exitCode);
  } catch (err) {
    if (!opts?.quiet) {
      console.error("[uri] audit failed:", err?.stack || err);
    }
    process.exit(1);
  }
});

/* ----------------------------- PATCH ----------------------------- */

addCommonOptions(
  program
    .command("patch")
    .description("Apply PATCHES/REPLACE and verify (not implemented in skeleton)")
).action(async (_inboxArg, opts) => {
  if (!opts.quiet) console.error("patch: not implemented yet (skeleton)");
  process.exit(2);
});

/* ----------------------------- ATTACH ----------------------------- */

addCommonOptions(
  program
    .command("attach")
    .description("Verify already-running server (not implemented in skeleton)")
).action(async (_inboxArg, opts) => {
  if (!opts.quiet) console.error("attach: not implemented yet (skeleton)");
  process.exit(2);
});

program.parse(process.argv);
