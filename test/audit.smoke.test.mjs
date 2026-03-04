import { describe, it, expect } from "vitest";
import fs from "fs-extra";
import path from "path";
import os from "os";
import unzipper from "unzipper";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import auditCjs from "../src/lib/audit.cjs";
import zipHelperCjs from "./helpers/zip-create.cjs";

const execFileAsync = promisify(execFile);
const { runAudit } = auditCjs;
const { makeZip } = zipHelperCjs;

async function sh(cwd, cmd, args) {
  const { stdout, stderr } = await execFileAsync(cmd, args, { cwd, encoding: "utf8" });
  return { stdout, stderr };
}

async function unzipToMem(zipPath) {
  const dir = await unzipper.Open.file(zipPath);
  const names = dir.files.map((f) => f.path);
  const getText = async (name) => {
    const f = dir.files.find((x) => x.path === name);
    if (!f) return null;
    const buf = await f.buffer();
    return buf.toString("utf8");
  };
  return { names, getText };
}

describe("audit (minimal) smoke", () => {
  it("creates outbox.zip with SNAPSHOT.txt and STATUS.json", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "uri-runner-"));
    const repo = path.join(tmp, "repo");
    await fs.ensureDir(repo);

    const inboxDir = path.join(repo, "artifacts", "inbox");
    const outboxDir = path.join(repo, "artifacts", "outbox");
    await fs.ensureDir(inboxDir);
    await fs.ensureDir(outboxDir);

    const runbook = path.resolve("test", "fixtures", "RUNBOOK.yaml");
    const inboxZip = path.join(inboxDir, "inbox.zip");
    const outboxZip = path.join(outboxDir, "outbox.zip");

    await makeZip(inboxZip, { "RUNBOOK.yaml": runbook });

    const res = await runAudit({
      cwd: repo,
      inboxPath: inboxZip,
      outboxPath: outboxZip,
      workspaceDir: path.join(repo, ".runner-work"),
    });

    expect(res.exitCode).toBe(0);
    expect(await fs.pathExists(outboxZip)).toBe(true);

    const z = await unzipToMem(outboxZip);
    expect(z.names).toContain("SNAPSHOT.txt");
    expect(z.names).toContain("STATUS.json");
    expect(z.names).toContain("REPORT/runbook.json");
    expect(z.names).toContain("REPORT/system.json");
    expect(z.names).toContain("REPORT/git.json");
    expect(z.names).toContain("REPORT/tree.txt");
    expect(z.names).toContain("REPORT/git.status.txt");
    expect(z.names).toContain("REPORT/git.log.txt");

    const statusText = await z.getText("STATUS.json");
    const status = JSON.parse(statusText);
    expect(status.ok).toBe(true);
    expect(status.profile).toBe("audit");

    const snap = await z.getText("SNAPSHOT.txt");
    expect(snap).toContain("SYSTEM");
    expect(snap).toContain("GIT");
    expect(snap).toContain("TREE");
  });

  it("best-effort outbox on missing runbook", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "uri-runner-"));
    const repo = path.join(tmp, "repo");
    await fs.ensureDir(repo);

    const inboxDir = path.join(repo, "artifacts", "inbox");
    const outboxDir = path.join(repo, "artifacts", "outbox");
    await fs.ensureDir(inboxDir);
    await fs.ensureDir(outboxDir);

    // empty inbox zip
    const inboxZip = path.join(inboxDir, "inbox.zip");
    const outboxZip = path.join(outboxDir, "outbox.zip");
    await makeZip(inboxZip, {});

    const res = await runAudit({
      cwd: repo,
      inboxPath: inboxZip,
      outboxPath: outboxZip,
      workspaceDir: path.join(repo, ".runner-work"),
    });

    expect(res.exitCode).toBe(11);
    expect(await fs.pathExists(outboxZip)).toBe(true);

    const z = await unzipToMem(outboxZip);
    expect(z.names).toContain("SNAPSHOT.txt");
    expect(z.names).toContain("STATUS.json");

    const statusText = await z.getText("STATUS.json");
    const status = JSON.parse(statusText);
    expect(status.ok).toBe(false);
    expect(status.errors[0].code).toBe("RUNBOOK_MISSING");
  });
it("runs audit checks and returns exitCode 30 when a check fails, exporting logs", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "uri-runner-"));
  const repo = path.join(tmp, "repo");
  await fs.ensureDir(repo);

  const inboxDir = path.join(repo, "artifacts", "inbox");
  const outboxDir = path.join(repo, "artifacts", "outbox");
  await fs.ensureDir(inboxDir);
  await fs.ensureDir(outboxDir);

  const runbook = path.resolve("test", "fixtures", "RUNBOOK_CHECKS.yaml");
  const inboxZip = path.join(inboxDir, "inbox.zip");
  const outboxZip = path.join(outboxDir, "outbox.zip");

  await makeZip(inboxZip, { "RUNBOOK.yaml": runbook });

  const res = await runAudit({
    cwd: repo,
    inboxPath: inboxZip,
    outboxPath: outboxZip,
    workspaceDir: path.join(repo, ".runner-work"),
  });

  expect(res.exitCode).toBe(30);

  const z = await unzipToMem(outboxZip);
  expect(z.names).toContain("STATUS.json");

  const statusText = await z.getText("STATUS.json");
  const status = JSON.parse(statusText);
  expect(status.ok).toBe(false);
  expect(Array.isArray(status.checks)).toBe(true);
  expect(status.checks.length).toBe(2);

  // logs should be present
  expect(z.names).toContain("REPORT/checks.ok.out.log");
  expect(z.names).toContain("REPORT/checks.ok.err.log");
  expect(z.names).toContain("REPORT/checks.fail.out.log");
  expect(z.names).toContain("REPORT/checks.fail.err.log");
});

it("starts a server and waits for HTTP readiness, exporting server logs + readiness.json", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "uri-runner-"));
  const repo = path.join(tmp, "repo");
  await fs.ensureDir(repo);

  const inboxDir = path.join(repo, "artifacts", "inbox");
  const outboxDir = path.join(repo, "artifacts", "outbox");
  await fs.ensureDir(inboxDir);
  await fs.ensureDir(outboxDir);

  // Copy fixture server into repo so node can run it relative to repo
  await fs.ensureDir(path.join(repo, "test", "fixtures"));
  await fs.copyFile(
    path.resolve("test", "fixtures", "http-server.cjs"),
    path.join(repo, "test", "fixtures", "http-server.cjs")
  );

  const runbook = path.resolve("test", "fixtures", "RUNBOOK_SERVER.yaml");
  const inboxZip = path.join(inboxDir, "inbox.zip");
  const outboxZip = path.join(outboxDir, "outbox.zip");

  await makeZip(inboxZip, { "RUNBOOK.yaml": runbook });

  const res = await runAudit({
    cwd: repo,
    inboxPath: inboxZip,
    outboxPath: outboxZip,
    workspaceDir: path.join(repo, ".runner-work"),
  });

  expect(res.exitCode).toBe(0);

  const z = await unzipToMem(outboxZip);
  expect(z.names).toContain("REPORT/server.out.log");
  expect(z.names).toContain("REPORT/server.err.log");
  expect(z.names).toContain("REPORT/readiness.json");

  const readinessText = await z.getText("REPORT/readiness.json");
  const readiness = JSON.parse(readinessText);
  expect(readiness.ok).toBe(true);
  expect(readiness.statusCode).toBe(200);
});

it("runs public URL checks and returns exitCode 42 when an URL fails, exporting urls.public.json", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "uri-runner-"));
  const repo = path.join(tmp, "repo");
  await fs.ensureDir(repo);

  const inboxDir = path.join(repo, "artifacts", "inbox");
  const outboxDir = path.join(repo, "artifacts", "outbox");
  await fs.ensureDir(inboxDir);
  await fs.ensureDir(outboxDir);

  // Copy fixture server into repo
  await fs.ensureDir(path.join(repo, "test", "fixtures"));
  await fs.copyFile(
    path.resolve("test", "fixtures", "http-server.cjs"),
    path.join(repo, "test", "fixtures", "http-server.cjs")
  );

  // Start server (fixed port 43123)
  const { spawn } = await import("node:child_process");
  const child = spawn("node", ["test/fixtures/http-server.cjs"], { cwd: repo, stdio: "ignore" });

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  await wait(150);

  const runbook = path.resolve("test", "fixtures", "RUNBOOK_URLS_PUBLIC.yaml");
  const inboxZip = path.join(inboxDir, "inbox.zip");
  const outboxZip = path.join(outboxDir, "outbox.zip");
  await makeZip(inboxZip, { "RUNBOOK.yaml": runbook });

  const res = await runAudit({
    cwd: repo,
    inboxPath: inboxZip,
    outboxPath: outboxZip,
    workspaceDir: path.join(repo, ".runner-work"),
  });

  child.kill("SIGTERM");

  expect(res.exitCode).toBe(42);

  const z = await unzipToMem(outboxZip);
  expect(z.names).toContain("REPORT/urls.public.json");

  const txt = await z.getText("REPORT/urls.public.json");
  const obj = JSON.parse(txt);
  expect(obj.ok).toBe(false);
  expect(obj.results.length).toBe(2);

  const statuses = obj.results.map((r) => r.status);
  expect(statuses).toContain(200);
  expect(statuses).toContain(404);
});

});
