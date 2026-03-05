#!/usr/bin/env node
/* eslint-disable no-console */

"use strict";

const { Command } = require("commander");
const path = require("node:path");

const { runAudit } = require("./lib/audit.cjs");
const { runPatch } = require("./lib/patch.cjs");
const { runDoctor } = require("./lib/doctor.cjs");
const { runUram } = require("./uram/pipeline.cjs");
const { buildInbox } = require("./lib/buildInbox.cjs");

const program = new Command();

program.name("uri").description("URI Runner").version("0.0.0");

function addCommonOptions(cmd) {
  return cmd
    .argument("[inbox]", "Path to inbox.zip (optional positional)")
    .option("--inbox <path>", "Path to inbox.zip", "artifacts/inbox/inbox.zip")
    .option("--outbox <path>", "Path to outbox.zip", "artifacts/outbox/outbox.zip")
    .option("--workspace <path>", "Workspace dir", ".runner-work")
    .option("--quiet", "No console output", false);
}

/* ----------------------------- AUDIT ----------------------------- */

addCommonOptions(program.command("audit").description("Run audit pipeline")).action(
  async (inboxArg, opts) => {
    try {
      const inbox = inboxArg || opts.inbox;

      if (!opts.quiet) console.log(`[uri] audit: inbox=${inbox}`);

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
      if (!opts?.quiet) console.error("[uri] audit failed:", err?.stack || err);
      process.exit(1);
    }
  },
);

/* ------------------------------ RUN ------------------------------ */

program
  .command("run")
  .description("Process URAM Inbox (~/uram) using RUNBOOK.yaml and write to <project>Box")
  .option("--uram <path>", "URAM root (default: ~/uram)")
  .option("--quiet", "No console output", false)
  .action(async (opts) => {
    try {
      const res = await runUram({
        uramRoot: opts.uram,
        quiet: !!opts.quiet,
      });
      process.exit(res.exitCode ?? 0);
    } catch (err) {
      if (!opts?.quiet) console.error("[uri] run failed:", err?.stack || err);
      process.exit(1);
    }
  });

program
  .command("fass")
  .description("Alias for `uri run` (German: fassen)")
  .option("--uram <path>", "URAM root (default: ~/uram)")
  .option("--quiet", "No console output", false)
  .action(async (opts) => {
    try {
      const res = await runUram({
        uramRoot: opts.uram,
        quiet: !!opts.quiet,
      });
      process.exit(res.exitCode ?? 0);
    } catch (err) {
      if (!opts?.quiet) console.error("[uri] fass failed:", err?.stack || err);
      process.exit(1);
    }
  });

/* ----------------------------- PATCH ----------------------------- */

program
  .command("patch")
  .description("Apply patchpack (PATCHES/REPLACE/APPLY.sh) into current repo/workdir")
  .argument("<zip>", "Path to patchpack zip")
  .option("--cwd <path>", "Target project dir (default: current dir)")
  .option("--workspace <path>", "Workspace dir (default: .runner-work)", ".runner-work")
  .option("--quiet", "No console output", false)
  .action(async (zipArg, opts) => {
    try {
      const zipPath = path.resolve(process.cwd(), zipArg);
      const cwd = path.resolve(process.cwd(), opts.cwd || process.cwd());
      const workspaceDir = path.resolve(process.cwd(), opts.workspace);

      if (!opts.quiet) console.log(`[uri] patch: ${zipPath}`);

      await runPatch({
        cwd,
        zipPath,
        workspaceDir,
      });

      if (!opts.quiet) console.log("[uri] patch: OK");
      process.exit(0);
    } catch (err) {
      if (!opts?.quiet) console.error("[uri] patch failed:", err?.stack || err);
      process.exit(1);
    }
  });

/* ---------------------------- DOCTOR ---------------------------- */

program
  .command("doctor")
  .description("MVP checks for current workspace (cwd + package.json + optional tests)")
  .option("--cwd <path>", "Project dir (default: current dir)")
  .option("--tests", "Run `npm test` if available", false)
  .option("--quiet", "No console output", false)
  .action(async (opts) => {
    try {
      const res = await runDoctor({
        cwd: path.resolve(process.cwd(), opts.cwd || process.cwd()),
        runTests: !!opts.tests,
        quiet: !!opts.quiet,
      });
      process.exit(res.exitCode ?? 0);
    } catch (err) {
      if (!opts?.quiet) console.error("[doctor] fatal:", err?.stack || err);
      process.exit(1);
    }
  });

/* -------------------------- BUILD INBOX -------------------------- */

program
  .command("build-inbox")
  .description("Build inbox.zip from project workspace")
  .option("--cwd <path>", "Project dir (default: current dir)")
  .option("--out <path>", "Output inbox.zip (default: ~/uram/Inbox/inbox.zip)")
  .option("--quiet", "No console output", false)
  .action(async (opts) => {
    try {
      const res = await buildInbox({
        cwd: path.resolve(process.cwd(), opts.cwd || process.cwd()),
        outPath: opts.out,
        quiet: !!opts.quiet,
      });
      process.exit(res.exitCode ?? 0);
    } catch (err) {
      if (!opts?.quiet) console.error("[build-inbox] fatal:", err?.stack || err);
      process.exit(1);
    }
  });

/* ----------------------------- ATTACH ---------------------------- */

addCommonOptions(program.command("attach").description("Verify already-running server (not implemented yet)")).action(
  async (_inboxArg, opts) => {
    if (!opts.quiet) console.error("attach: not implemented yet");
    process.exit(2);
  },
);

program.parse(process.argv);
