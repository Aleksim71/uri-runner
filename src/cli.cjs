#!/usr/bin/env node
/* eslint-disable no-console */

const { Command } = require("commander");
const path = require("path");

const { runAudit } = require("./lib/audit.cjs");
const { runPatch } = require("./lib/patch.cjs");
const { runDoctor } = require("./lib/doctor.cjs");
const { buildInbox } = require("./lib/buildInbox.cjs");

const program = new Command();

program
  .name("uri")
  .description("URI Runner")
  .version("1.0.0");

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
    .command("audit", { isDefault: false })
    .description("Run audit pipeline")
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

/* ----------------------------- RUN ----------------------------- */

program
  .command("run")
  .description("Process URAM Inbox (~/uram) using RUNBOOK.yaml and write to <project>Box")
  .action(() => {
    const { spawnSync } = require("child_process");
    const res = spawnSync("node", [path.join(__dirname, "uram", "pipeline.cjs")], {
      stdio: "inherit",
    });

    process.exit(res.status || 0);
  });

program
  .command("fass")
  .description("Alias for `uri run` (German: fassen)")
  .action(() => {
    const { spawnSync } = require("child_process");
    const res = spawnSync("node", [path.join(__dirname, "uram", "pipeline.cjs")], {
      stdio: "inherit",
    });

    process.exit(res.status || 0);
  });

/* ----------------------------- PATCH ----------------------------- */

addCommonOptions(
  program
    .command("patch")
    .description("Apply patchpack (PATCHES/REPLACE/APPLY.sh) into current repo/workdir")
).action(async (inboxArg, opts) => {
  try {
    const inbox = inboxArg || opts.inbox;

    console.log("[uri] patch:", inbox);

    await runPatch({
      patchPath: path.resolve(process.cwd(), inbox),
      cwd: process.cwd(),
    });

    console.log("[patch] done");
  } catch (err) {
    console.error("[uri] patch failed:", err?.stack || err);
    process.exit(1);
  }
});

/* ----------------------------- DOCTOR ----------------------------- */

program
  .command("doctor")
  .description("MVP checks for current workspace (cwd + package.json + optional tests)")
  .option("--cwd <path>", "Workspace directory", process.cwd())
  .option("--tests", "Run npm test if available", false)
  .action(async (opts) => {
    try {
      const res = await runDoctor({
        cwd: path.resolve(opts.cwd),
        runTests: Boolean(opts.tests),
      });

      process.exit(res.exitCode);
    } catch (err) {
      console.error("[doctor] fatal:", err?.stack || err);
      process.exit(1);
    }
  });

/* ----------------------------- BUILD INBOX ----------------------------- */

program
  .command("build-inbox")
  .description("Build inbox.zip from project workspace")
  .option("--cwd <path>", "Project directory", process.cwd())
  .option("--uram <path>", "URAM root", path.join(process.env.HOME, "uram"))
  .action(async (opts) => {
    try {
      await buildInbox({
        cwd: path.resolve(opts.cwd),
        uramRoot: path.resolve(opts.uram),
      });
    } catch (err) {
      console.error("[uri] build-inbox failed:", err?.message || err);
      process.exit(1);
    }
  });

/* ----------------------------- ATTACH ----------------------------- */

addCommonOptions(
  program
    .command("attach")
    .description("Verify already-running server (not implemented yet)")
).action(async () => {
  console.error("attach: not implemented yet");
  process.exit(2);
});

program.parse(process.argv);
