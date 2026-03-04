/* Minimal audit: validates inbox + produces outbox with SNAPSHOT/STATUS */
const fs = require("fs-extra");
const path = require("path");
const os = require("os");

const { runCmd } = require("./exec.cjs");
const { runChecks } = require("./checks.cjs");

const { unzipToDir, zipFiles } = require("./zip.cjs");
const { readRunbook } = require("./runbook.cjs");

function isoNow() {
  return new Date().toISOString();
}

function makeRunId() {
  const rnd = Math.random().toString(16).slice(2, 8);
  return `${isoNow().replace(/[:.]/g, "-")}_${rnd}`;
}

function writeSnapshot({ cwd, runId, ok, exitCode, system, git, treeLineCount }) {
  const lines = [];
  lines.push("URI RUNNER SNAPSHOT");
  lines.push("");
  lines.push(`run_id: ${runId}`);
  lines.push(`time: ${isoNow()}`);
  lines.push(`cwd: ${cwd}`);
  lines.push("");

  lines.push("SYSTEM");
  lines.push(`node: ${system?.node ?? process.version}`);
  lines.push(`platform: ${system?.platform ?? os.platform()} ${system?.release ?? os.release()}`);
  lines.push(`arch: ${system?.arch ?? os.arch()}`);
  lines.push("");

  lines.push("GIT");
  if (git?.available) {
    lines.push(`branch: ${git.branch ?? "unknown"}`);
    const dirty = (git.status_porcelain ?? "").trim().length > 0;
    lines.push(`dirty: ${dirty ? "yes" : "no"}`);
    lines.push("log (last 5):");
    const logLines = (git.log_oneline_5 ?? "").trim().split("\n").filter(Boolean);
    for (const l of logLines) lines.push(`  ${l}`);
  } else {
    lines.push("git: not available");
  }
  lines.push("");

  lines.push("TREE");
  lines.push(`tracked_files: ${typeof treeLineCount === "number" ? treeLineCount : 0}`);
  lines.push("");

  lines.push(`result: ${ok ? "OK" : "FAIL"} (exit_code=${exitCode})`);
  lines.push("");
return lines.join("\n");
}


async function runAudit({ cwd, inboxPath, outboxPath, workspaceDir }) {
  const runId = makeRunId();
  const workRoot = path.join(workspaceDir, runId);
  const inboxDir = path.join(workRoot, "inbox");

  const status = {
    ok: false,
    run_id: runId,
    profile: "audit",
    steps: [],
    errors: [],
  };

  function step(name, ok, extra = {}) {
    status.steps.push({ name, ok, ...extra });
  }

  try {
    // 1) inbox exists
    if (!(await fs.pathExists(inboxPath))) {
      step("inbox.exists", false, { path: inboxPath });
      const err = new Error(`inbox not found: ${inboxPath}`);
      err.code = "INBOX_MISSING";
      throw err;
    }
    step("inbox.exists", true);

    // 2) extract inbox
    await fs.remove(inboxDir);
    await unzipToDir(inboxPath, inboxDir);
    step("inbox.extract", true, { dir: inboxDir });

    // 3) read runbook
    const runbookPath = path.join(inboxDir, "RUNBOOK.yaml");
    if (!(await fs.pathExists(runbookPath))) {
      step("runbook.exists", false);
      const err = new Error("RUNBOOK.yaml missing in inbox");
      err.code = "RUNBOOK_MISSING";
      throw err;
    }
    const runbook = await readRunbook(runbookPath);
    step("runbook.read", true);

// 4) prepare report files
const reportDir = path.join(workRoot, "report");
await fs.ensureDir(reportDir);

// 4a) system report
const systemJsonPath = path.join(reportDir, "system.json");
await fs.writeJson(systemJsonPath, {
  node: process.version,
  platform: os.platform(),
  release: os.release(),
  arch: os.arch(),
  cwd,
  pid: process.pid,
  time: isoNow(),
}, { spaces: 2 });

// 4b) git report (best-effort)
const gitDir = path.join(cwd, ".git");
const gitReport = { available: false };

if (await fs.pathExists(gitDir)) {
  const which = await runCmd("git", ["--version"], { cwd });
  if (which.exitCode === 0) {
    gitReport.available = true;

    const branch = await runCmd("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd });
    gitReport.branch = branch.exitCode === 0 ? branch.stdout.trim() : null;

    const statusPorcelain = await runCmd("git", ["status", "--porcelain"], { cwd });
    gitReport.status_porcelain = statusPorcelain.exitCode === 0 ? statusPorcelain.stdout : null;

    const log = await runCmd("git", ["log", "--oneline", "-5"], { cwd });
    gitReport.log_oneline_5 = log.exitCode === 0 ? log.stdout : null;
  }
}

const gitJsonPath = path.join(reportDir, "git.json");
await fs.writeJson(gitJsonPath, gitReport, { spaces: 2 });

// 4b.1) human-friendly git files
const gitStatusPath = path.join(reportDir, "git.status.txt");
const gitLogPath = path.join(reportDir, "git.log.txt");

if (gitReport.available) {
  await fs.writeFile(gitStatusPath, gitReport.status_porcelain ?? "", "utf8");
  await fs.writeFile(gitLogPath, gitReport.log_oneline_5 ?? "", "utf8");
} else {
  await fs.writeFile(gitStatusPath, "", "utf8");
  await fs.writeFile(gitLogPath, "", "utf8");
}

// 4c) project tree snapshot
// Prefer `git ls-files` when available (stable + ignores artifacts).
let treeText = "";
if (gitReport.available) {
  const ls = await runCmd("git", ["ls-files"], { cwd });
  treeText = ls.exitCode === 0 ? ls.stdout : "";
}
const treePath = path.join(reportDir, "tree.txt");
await fs.writeFile(treePath, treeText, "utf8");


    const runbookJsonPath = path.join(reportDir, "runbook.json");
    await fs.writeJson(runbookJsonPath, runbook, { spaces: 2 });
// 4d) checks (optional) — runbook.audit.checks
const checks = (runbook.audit && Array.isArray(runbook.audit.checks)) ? runbook.audit.checks : [];
const checksRes = await runChecks({ cwd, reportDir, checks });
step("checks.run", checksRes.ok, { count: checks.length });
status.checks = checksRes.results;


    // 5) create outbox zip
    const snapshotText = writeSnapshot({ cwd, runId, ok: true, exitCode: status.ok ? 0 : 30, system: await fs.readJson(systemJsonPath), git: gitReport, treeLineCount: treeText ? treeText.split(/\n/).filter(Boolean).length : 0 });
    const snapshotPath = path.join(workRoot, "SNAPSHOT.txt");
    await fs.writeFile(snapshotPath, snapshotText, "utf8");

    status.ok = Boolean(checksRes.ok);
    const statusPath = path.join(workRoot, "STATUS.json");
    await fs.writeJson(statusPath, status, { spaces: 2 });

    const outEntries = {
  "SNAPSHOT.txt": snapshotPath,
  "STATUS.json": statusPath,
  "REPORT/runbook.json": runbookJsonPath,
  "REPORT/system.json": systemJsonPath,
  "REPORT/git.json": gitJsonPath,
  "REPORT/git.status.txt": gitStatusPath,
  "REPORT/git.log.txt": gitLogPath,
  "REPORT/tree.txt": treePath,
};

// include check logs (if any)
if (Array.isArray(status.checks)) {
  for (const c of status.checks) {
    const outAbs = path.join(reportDir, `checks.${c.name.replace(/[^a-zA-Z0-9._-]+/g, "_")}.out.log`);
    const errAbs = path.join(reportDir, `checks.${c.name.replace(/[^a-zA-Z0-9._-]+/g, "_")}.err.log`);
    if (await fs.pathExists(outAbs)) outEntries[`REPORT/${path.basename(outAbs)}`] = outAbs;
    if (await fs.pathExists(errAbs)) outEntries[`REPORT/${path.basename(errAbs)}`] = errAbs;
  }
}

await zipFiles(outboxPath, outEntries);
    step("outbox.write", true, { path: outboxPath });

    return { exitCode: status.ok ? 0 : 30, runId };
  } catch (e) {
    const code = e && e.code ? e.code : "UNKNOWN";
    status.ok = false;
    status.errors.push({ code, message: String(e && e.message ? e.message : e) });

    let exitCode = 20;
    if (code === "INBOX_MISSING") exitCode = 10;
    if (code === "RUNBOOK_MISSING") exitCode = 11;
    if (code === "RUNBOOK_INVALID") exitCode = 12;

    // Attempt to still write outbox (best effort)
    try {
      await fs.ensureDir(path.dirname(outboxPath));
      await fs.ensureDir(workRoot);

      const snapshotText = writeSnapshot({ cwd, runId, ok: false, exitCode, system: { node: process.version, platform: os.platform(), release: os.release(), arch: os.arch() }, git: { available: false }, treeLineCount: 0 });
      const snapshotPath = path.join(workRoot, "SNAPSHOT.txt");
      await fs.writeFile(snapshotPath, snapshotText, "utf8");

      const statusPath = path.join(workRoot, "STATUS.json");
      await fs.writeJson(statusPath, status, { spaces: 2 });

      await zipFiles(outboxPath, {
        "SNAPSHOT.txt": snapshotPath,
        "STATUS.json": statusPath,
      });
      step("outbox.write", true, { path: outboxPath, best_effort: true });
    } catch (_) {
      // ignore
    }

    return { exitCode, runId };
  }
}

module.exports = { runAudit };
