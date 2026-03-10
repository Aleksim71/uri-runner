"use strict";

const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const unzipper = require("unzipper");
const YAML = require("yaml");

const { runAudit } = require("../lib/audit.cjs");
const {
  resolveUramRoot,
  getInboxZipPath,
  getProcessedDir,
  getTmpDir,
  getProjectBoxDir,
  getHistoryDir,
  getLatestOutboxPath,
} = require("./paths.cjs");

function stampBerlin(d = new Date()) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const m = Object.fromEntries(parts.filter((p) => p.type !== "literal").map((p) => [p.type, p.value]));
  return `${m.year}-${m.month}-${m.day}_${m.hour}-${m.minute}-${m.second}`;
}

function isoBerlin() {
  const s = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .format(new Date())
    .replace(" ", "T");

  const tzOffsetMin = -new Date().getTimezoneOffset();
  const sign = tzOffsetMin >= 0 ? "+" : "-";
  const hh = String(Math.floor(Math.abs(tzOffsetMin) / 60)).padStart(2, "0");
  const mm = String(Math.abs(tzOffsetMin) % 60).padStart(2, "0");
  return `${s}${sign}${hh}:${mm}`;
}

function makeRunId() {
  const iso = new Date().toISOString().replace(/[:.]/g, "-");
  const rnd = crypto.randomBytes(3).toString("hex");
  return `${iso}_${rnd}`;
}

async function ensureDir(p) {
  await fsp.mkdir(p, { recursive: true });
}

async function readRunbookFromInboxZip(inboxZipPath) {
  const z = fs.createReadStream(inboxZipPath).pipe(unzipper.Parse({ forceStream: true }));
  for await (const entry of z) {
    const name = entry.path.replace(/\\/g, "/");
    if (name === "RUNBOOK.yaml" || name.endsWith("/RUNBOOK.yaml")) {
      const buf = await entry.buffer();
      const txt = buf.toString("utf-8");
      const runbook = YAML.parse(txt);
      return { runbook, raw: txt };
    }
    entry.autodrain();
  }
  return { runbook: null, raw: null };
}

function validateRunbook(runbook) {
  if (!runbook || typeof runbook !== "object") throw new Error("RUNBOOK.yaml is missing or invalid YAML");
  if (runbook.version !== 1) throw new Error("RUNBOOK.yaml: version must be 1");
  if (!runbook.project || typeof runbook.project !== "string") throw new Error("RUNBOOK.yaml: project is required (string)");
  if (!runbook.cwd || typeof runbook.cwd !== "string") throw new Error("RUNBOOK.yaml: cwd is required (absolute path)");
  if (!path.isAbsolute(runbook.cwd)) throw new Error("RUNBOOK.yaml: cwd must be an absolute path");
  if (!runbook.profile || typeof runbook.profile !== "string") throw new Error("RUNBOOK.yaml: profile is required (string)");
  return runbook;
}

async function appendJsonl(filePath, obj) {
  await fsp.appendFile(filePath, `${JSON.stringify(obj)}\n`, "utf-8");
}

async function atomicCopyToLatest(srcFile, latestPath, runId) {
  const dir = path.dirname(latestPath);
  await ensureDir(dir);
  const tmp = path.join(dir, `.tmp.latest.${runId}.zip`);
  await fsp.copyFile(srcFile, tmp);
  await fsp.rename(tmp, latestPath);
}

async function runUramPipeline({ uramCli, workspaceCli, keepWorkspace, verbose, quiet, env, homeDir }) {
  const uramRoot = resolveUramRoot({ cliUram: uramCli, env, homeDir });

  const inboxZipPath = getInboxZipPath(uramRoot);
  const processedDir = getProcessedDir(uramRoot);
  const workspaceRoot = workspaceCli ? path.resolve(workspaceCli) : getTmpDir(uramRoot);

  const startedAt = Date.now();
  const runId = makeRunId();

  if (verbose && !quiet) console.log(`[uri] run: uramRoot=${uramRoot}`);
  if (verbose && !quiet) console.log(`[uri] run: inbox=${inboxZipPath}`);

  try {
    await fsp.access(inboxZipPath, fs.constants.R_OK);
  } catch {
    if (!quiet) console.error(`[uri] run: inbox not found: ${inboxZipPath}`);
    return { exitCode: 10 };
  }

  const { runbook } = await readRunbookFromInboxZip(inboxZipPath);
  if (!runbook) {
    if (!quiet) console.error("[uri] run: RUNBOOK.yaml missing in inbox.zip");
    return { exitCode: 11 };
  }

  const rb = validateRunbook(runbook);
  const project = rb.project.trim();
  const profile = rb.profile.trim();

  const projectBoxDir = getProjectBoxDir(uramRoot, project);
  const historyDir = getHistoryDir(projectBoxDir);
  const latestOutboxPath = getLatestOutboxPath(projectBoxDir);

  await ensureDir(projectBoxDir);
  await ensureDir(historyDir);
  await ensureDir(processedDir);
  await ensureDir(workspaceRoot);

  const stamp = stampBerlin();
  const tmpOutboxPath = path.join(projectBoxDir, `.tmp.outbox.${runId}.zip`);

  let exitCode = 2;
  let auditRes = null;
  const prevCwd = process.cwd();
  try {
    if (profile !== "audit") {
      if (!quiet) console.error(`[uri] run: unsupported profile for v1: ${profile} (only audit)`);
      return { exitCode: 2 };
    }

    process.chdir(rb.cwd);
    if (!quiet) console.log(`[uri] run: project=${project}, profile=${profile}, cwd=${rb.cwd}`);

    auditRes = await runAudit({
      cwd: rb.cwd,
      inboxPath: inboxZipPath,
      outboxPath: tmpOutboxPath,
      workspaceDir: workspaceRoot,
    });
    exitCode = auditRes.exitCode;
  } finally {
    process.chdir(prevCwd);
  }

  const ok = exitCode === 0;
  const statusText = ok ? "OK" : "FAIL";

  await fsp.access(tmpOutboxPath, fs.constants.R_OK);

  const historyOutboxName = `${stamp}__${profile}__${statusText}__${runId}.outbox.zip`;
  const historyOutboxPath = path.join(historyDir, historyOutboxName);
  await fsp.rename(tmpOutboxPath, historyOutboxPath);

  await atomicCopyToLatest(historyOutboxPath, latestOutboxPath, runId);

  const durationMs = Date.now() - startedAt;
  const indexPath = path.join(historyDir, "index.jsonl");
  await appendJsonl(indexPath, {
    ts: isoBerlin(),
    run_id: runId,
    project,
    profile,
    ok,
    exit_code: exitCode,
    duration_ms: durationMs,
    cwd: rb.cwd,
    inbox_name: path.basename(inboxZipPath),
    outbox_rel_path: path.join("history", historyOutboxName),
  });

  const processedInboxName = `${stamp}__${project}__${runId}.inbox.zip`;
  const processedInboxPath = path.join(processedDir, processedInboxName);
  await fsp.rename(inboxZipPath, processedInboxPath);

  void keepWorkspace;

  if (!quiet) {
    console.log(`[uri] run: exitCode=${exitCode}`);
    console.log(`[uri] run: latest=${latestOutboxPath}`);
    console.log(`[uri] run: history=${historyOutboxPath}`);
    console.log(`[uri] run: inbox processed=${processedInboxPath}`);
  }

  return { exitCode, auditRes };
}

module.exports = { runUramPipeline };
