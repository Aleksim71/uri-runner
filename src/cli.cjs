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
    .option("--inbox <path>", "Path to inbox.zip", "artifacts/inbox/inbox.zip")
    .option("--outbox <path>", "Path to outbox.zip", "artifacts/outbox/outbox.zip")
    .option("--workspace <path>", "Workspace dir", ".runner-work");
}

addCommonOptions(
  program
    .command("audit", { isDefault: true })
    .description("Run audit pipeline (read-only minimal skeleton)")
).action(async (opts) => {
  const res = await runAudit({
    cwd: process.cwd(),
    inboxPath: path.resolve(process.cwd(), opts.inbox),
    outboxPath: path.resolve(process.cwd(), opts.outbox),
    workspaceDir: path.resolve(process.cwd(), opts.workspace),
  });
  process.exit(res.exitCode);
});

addCommonOptions(
  program.command("patch").description("Apply PATCHES/REPLACE and verify (not implemented in skeleton)")
).action(async () => {
  console.error("patch: not implemented yet (skeleton)");
  process.exit(2);
});

addCommonOptions(
  program.command("attach").description("Verify already-running server (not implemented in skeleton)")
).action(async () => {
  console.error("attach: not implemented yet (skeleton)");
  process.exit(2);
});

program.parse(process.argv);
