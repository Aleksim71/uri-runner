#!/usr/bin/env node
/* eslint-disable no-console */

"use strict";

const { Command } = require("commander");
const path = require("path");

const { runAudit } = require("./lib/audit.cjs");
const { runPatch } = require("./lib/patch.cjs");
const { runDoctor } = require("./lib/doctor.cjs");

const program = new Command();

program
  .name("uri")
  .description("URI Runner")
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

/* ----------------------------- RUN / FASS ----------------------------- */

program
  .command("run")
  .description("Process URAM Inbox (~/uram) using RUNBOOK.yaml and write to <project>Box (latest + history)")
  .action(async () => {
    try {
      // src/uram/run.cjs is the stable entrypoint
      // eslint-disable-next-line global-require
      const mod = require("./uram/run.cjs");
      if (mod && typeof mod.run === "function") {
        await mod.run(process.argv);
        process.exit(0);
      }
      if (mod && typeof mod.main === "function") {
        await mod.main(process.argv);
        process.exit(0);
      }
      console.error("[uri] run: invalid export from ./src/uram/run.cjs");
      process.exit(2);
    } catch (err) {
      console.error("[uri] run failed:", err?.stack || err);
      process.exit(1);
    }
  });

program
  .command("fass")
  .description("Alias for `uri run` (German: fassen)")
  .action(async () => {
    try {
      // eslint-disable-next-line global-require
      const mod = require("./uram/run.cjs");
      if (mod && typeof mod.run === "function") {
        await mod.run(process.argv);
        process.exit(0);
      }
      if (mod && typeof mod.main === "function") {
        await mod.main(process.argv);
        process.exit(0);
      }
      console.error("[uri] fass: invalid export from ./src/uram/run.cjs");
      process.exit(2);
    } catch (err) {
      console.error("[uri] fass failed:", err?.stack || err);
      process.exit(1);
    }
  });

/* ----------------------------- PATCH ----------------------------- */

addCommonOptions(
  program
    .command("patch")
    .description("Apply patchpack (PATCHES/REPLACE/APPLY.sh) into current repo/workdir")
).action(async (inboxArg, opts) => {
  try {
    const zipPath = inboxArg || opts.inbox;

    if (!opts.quiet) {
      console.log(`[uri] patch: ${zipPath}`);
    }

    await runPatch({
      cwd: process.cwd(),
      zipPath: path.resolve(process.cwd(), zipPath),
      workspace: path.resolve(process.cwd(), opts.workspace),
    });

    process.exit(0);
  } catch (err) {
    if (!opts?.quiet) {
      console.error("[uri] patch failed:", err?.stack || err);
    }
    process.exit(1);
  }
});

/* ----------------------------- DOCTOR (MVP) ----------------------------- */

program
  .command("doctor")
  .description("MVP checks for current workspace (cwd + package.json + optional tests)")
  .option("--cwd <path>", "Workspace dir to check", process.cwd())
  .option("--tests", "Run `npm test` if available", false)
  .action(async (opts) => {
    try {
      const cwd = path.resolve(opts.cwd);
      const res = await runDoctor({ cwd, runTests: Boolean(opts.tests) });
      process.exit(res.exitCode);
    } catch (err) {
      console.error("[uri] doctor failed:", err?.stack || err);
      process.exit(1);
    }
  });

/* ----------------------------- ATTACH ----------------------------- */

addCommonOptions(
  program
    .command("attach")
    .description("Verify already-running server (not implemented yet)")
).action(async (_inboxArg, opts) => {
  if (!opts.quiet) console.error("attach: not implemented yet");
  process.exit(2);
});

program.parse(process.argv);
