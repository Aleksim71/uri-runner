// path: test/scenarios/scenario-runtime.file-delivery-report.test.mjs
import { describe, it, expect } from "vitest";
import fs from "fs";
import fsp from "fs/promises";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { runUramPipeline } = require("../../src/uram/pipeline.cjs");

async function ensureDir(p) {
  await fsp.mkdir(p, { recursive: true });
}

async function writeFile(p, body) {
  await ensureDir(path.dirname(p));
  await fsp.writeFile(p, body, "utf8");
}

function zipRunbook(tempDir, runbookText) {
  const runbookPath = path.join(tempDir, "RUNBOOK.yaml");
  fs.writeFileSync(runbookPath, runbookText, "utf8");

  const zipPath = path.join(tempDir, "inbox.zip");

  execFileSync("zip", ["-j", zipPath, runbookPath], {
    cwd: tempDir,
    stdio: "ignore",
  });

  return zipPath;
}

function unzipJson(zipPath, entryName) {
  const raw = execFileSync("unzip", ["-p", zipPath, entryName], {
    encoding: "utf8",
  });

  return JSON.parse(raw);
}

function unzipList(zipPath) {
  return execFileSync("unzip", ["-Z1", zipPath], {
    encoding: "utf8",
  })
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .sort();
}

describe("scenario runtime file delivery report", () => {
  it("attaches project tree and reports missing required files without flipping execution exitCode", async () => {
    const root = await fsp.mkdtemp(path.join(os.tmpdir(), "uri-v3-delivery-report-"));

    const uramRoot = path.join(root, "uram");
    const projectName = "demo";
    const projectRoot = path.join(root, "projects", projectName);

    await ensureDir(uramRoot);
    await ensureDir(projectRoot);

    await writeFile(
      path.join(uramRoot, "config/projects.yaml"),
      [
        "version: 1",
        "projects:",
        `  ${projectName}:`,
        `    cwd: ${projectRoot}`,
        "",
      ].join("\n")
    );

    await writeFile(
      path.join(projectRoot, "contexts/system/executable.yaml"),
      [
        "version: 1",
        "",
        "engine: scenario",
        "",
        "commands:",
        "  roots:",
        "    - system",
        "",
        "runtime:",
        "  max_steps: 100",
        "  strict_commands: true",
        "",
      ].join("\n")
    );

    await writeFile(path.join(projectRoot, "report.txt"), "hello\nworld\n");

    const runbookText = [
      "version: 1",
      `project: ${projectName}`,
      "steps:",
      "  - id: step_echo_1",
      "    command: system.echo",
      "    args:",
      '      message: "hello delivery report"',
      "provide:",
      "  - kind: file",
      "    path: report.txt",
      "  - kind: file",
      "    path: missing.txt",
      "",
    ].join("\n");

    const tmpZipDir = path.join(root, "zip-src");
    await ensureDir(tmpZipDir);

    const builtInboxZip = zipRunbook(tmpZipDir, runbookText);

    const inboxDir = path.join(uramRoot, "Inbox");
    await ensureDir(inboxDir);

    const inboxZipPath = path.join(inboxDir, "inbox.zip");
    await fsp.copyFile(builtInboxZip, inboxZipPath);

    const res = await runUramPipeline({
      uramCli: uramRoot,
      workspaceCli: path.join(root, "workspace"),
      quiet: true,
      env: process.env,
      homeDir: os.homedir(),
    });

    expect(res.exitCode).toBe(0);
    expect(res.ok).toBe(true);
    expect(res.fileDeliveryReport).toMatchObject({
      ok: false,
      error: {
        code: "REQUIRED_FILES_DELIVERY_FAILED",
      },
      summary: {
        requested: 2,
        provided: 1,
        missing: 1,
        failed: 0,
      },
      requestedFiles: ["report.txt", "missing.txt"],
      providedFiles: ["report.txt"],
      projectTree: {
        attached: true,
        path: "provided/project-tree.txt",
      },
    });

    const projectBoxDir = path.join(uramRoot, `${projectName}Box`);
    const latestOutbox = path.join(projectBoxDir, "outbox.latest.zip");
    const entries = unzipList(latestOutbox);

    expect(entries).toContain("outbox.json");
    expect(entries).toContain("provided/report.txt");
    expect(entries).toContain("provided/project-tree.txt");

    const outbox = unzipJson(latestOutbox, "outbox.json");
    expect(outbox.status).toBe("success");
    expect(outbox.fileDeliveryReport).toMatchObject({
      ok: false,
      error: {
        code: "REQUIRED_FILES_DELIVERY_FAILED",
      },
      summary: {
        requested: 2,
        provided: 1,
        missing: 1,
        failed: 0,
      },
      requestedFiles: ["report.txt", "missing.txt"],
      providedFiles: ["report.txt"],
      projectTree: {
        attached: true,
        path: "provided/project-tree.txt",
      },
    });
  });
});
