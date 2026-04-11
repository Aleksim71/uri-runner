/* path: test/real/watch-pipeline.contract-conflict.real.test.mjs */
import { describe, it, expect } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const PROJECT_ROOT = process.env.URI_PROJECT_ROOT || process.cwd();
const DOWNLOADS_DIR = process.env.URI_DOWNLOADS_DIR || path.join(os.homedir(), "Загрузки");

const PROJECT_OUTBOX_ZIP =
  process.env.URI_PROJECT_OUTBOX_ZIP ||
  path.join(os.homedir(), "workspace", "projects", "tempasi", "Outbox", "outbox.zip");

const TRANSPORT_OUTBOX_ZIP =
  process.env.URI_TRANSPORT_OUTBOX_ZIP ||
  path.join(PROJECT_ROOT, "runtime", "watch", "processed", "outbox.zip");

const FIXTURE_ZIP = path.join(PROJECT_ROOT, "test", "fixtures", "01_contract_conflict.zip");

async function exists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function statMtime(targetPath) {
  try {
    const stat = await fs.stat(targetPath);
    return stat.mtimeMs;
  } catch {
    return 0;
  }
}

async function copyFixtureToDownloads() {
  await fs.mkdir(DOWNLOADS_DIR, { recursive: true });
  await fs.copyFile(FIXTURE_ZIP, path.join(DOWNLOADS_DIR, "inbox.zip"));
}

async function runWatcherOnce() {
  const { stdout = "", stderr = "" } = await execFileAsync(
    "uri",
    ["watch", "--once"],
    {
      cwd: PROJECT_ROOT,
      maxBuffer: 10 * 1024 * 1024,
      env: { ...process.env },
    }
  );

  return { stdout, stderr };
}

async function resolveFreshOutbox(beforeProjectMtime, beforeTransportMtime) {
  const projectExists = await exists(PROJECT_OUTBOX_ZIP);
  const transportExists = await exists(TRANSPORT_OUTBOX_ZIP);

  const projectMtime = await statMtime(PROJECT_OUTBOX_ZIP);
  const transportMtime = await statMtime(TRANSPORT_OUTBOX_ZIP);

  if (projectExists && projectMtime > beforeProjectMtime) {
    return PROJECT_OUTBOX_ZIP;
  }

  if (transportExists && transportMtime > beforeTransportMtime) {
    return TRANSPORT_OUTBOX_ZIP;
  }

  if (projectExists) return PROJECT_OUTBOX_ZIP;
  if (transportExists) return TRANSPORT_OUTBOX_ZIP;

  throw new Error("outbox.zip not found after watcher run");
}

async function readJsonFromZip(zipPath, archivePath) {
  const { stdout } = await execFileAsync("unzip", ["-p", zipPath, archivePath], {
    cwd: PROJECT_ROOT,
    maxBuffer: 10 * 1024 * 1024,
  });

  return JSON.parse(stdout);
}

async function readOutboxPayload(zipPath) {
  try {
    return await readJsonFromZip(zipPath, "outbox.json");
  } catch {
    return await readJsonFromZip(zipPath, "REPORT/outbox.json");
  }
}

describe("watch pipeline contract conflict real", () => {
  it(
    "fails for 01_contract_conflict.zip and surfaces a non-success outbox",
    async () => {
      const beforeProjectMtime = await statMtime(PROJECT_OUTBOX_ZIP);
      const beforeTransportMtime = await statMtime(TRANSPORT_OUTBOX_ZIP);

      await copyFixtureToDownloads();

      const run = await runWatcherOnce();

      expect(run.stdout).toContain("status: started");
      expect(run.stdout).toContain("status: inbox.zip detected");
      expect(run.stdout).toContain("status: accepted");
      expect(run.stdout).toContain("status: execution started");
      expect(run.stdout).toContain("status: execution failed");

      const outboxZipPath = await resolveFreshOutbox(beforeProjectMtime, beforeTransportMtime);
      const outbox = await readOutboxPayload(outboxZipPath);

      const serialized = JSON.stringify(outbox);

      const isFailure =
        outbox?.ok === false ||
        outbox?.status === "error" ||
        outbox?.status === "failed" ||
        outbox?.status === "compile_error" ||
        outbox?.status === "execution_failed" ||
        Number.isInteger(outbox?.exitCode) && outbox.exitCode !== 0 ||
        /error|duplicate|invalid|conflict|step_dup/i.test(serialized);

      expect(isFailure).toBe(true);
      expect(serialized).toMatch(/duplicate|invalid|conflict|step_dup|error/i);
    },
    60000
  );
});
