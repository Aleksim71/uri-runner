"use strict";

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function run(cmd, cwd) {
  return execSync(cmd, { cwd, encoding: "utf8" }).trim();
}

async function buildInbox({ cwd, uramRoot }) {
  const inboxDir = path.join(uramRoot, "Inbox");
  const tmp = path.join("/tmp", "uri_build_inbox");

  fs.rmSync(tmp, { recursive: true, force: true });
  ensureDir(tmp);
  ensureDir(path.join(tmp, "INPUT"));

  const runbookSrc = path.join(uramRoot, "docs", "RUNBOOK.example.yaml");
  const runbookDst = path.join(tmp, "RUNBOOK.yaml");

  if (!fs.existsSync(runbookSrc)) {
    throw new Error("RUNBOOK.example.yaml not found in URAM docs");
  }

  fs.copyFileSync(runbookSrc, runbookDst);

  const snapshot = [
    `PROJECT: ${path.basename(cwd)}`,
    `TIME: ${new Date().toISOString()}`,
    `CWD: ${cwd}`,
    "",
    "GIT HEAD:",
    run("git rev-parse --short HEAD || true", cwd),
    "",
    "GIT STATUS:",
    run("git status -sb || true", cwd),
  ].join("\n");

  fs.writeFileSync(path.join(tmp, "INPUT", "SNAPSHOT.txt"), snapshot);

  const tree = run("find . -maxdepth 4 -type f | sort", cwd);
  fs.writeFileSync(path.join(tmp, "INPUT", "FILE_TREE.txt"), tree);

  const zipPath = path.join(inboxDir, "inbox.zip");

  execSync(`zip -qr ${zipPath} .`, { cwd: tmp });

  console.log("[build-inbox] created:", zipPath);
}

module.exports = { buildInbox };
