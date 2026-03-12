import { describe, it, expect } from "vitest";
import fs from "fs";
import fsp from "fs/promises";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { runUramPipeline } = require("../../src/uram/pipeline.cjs");
const {
  getProjectBoxDir,
  getHistoryDir,
  getLatestOutboxPath,
} = require("../../src/uram/paths.cjs");

async function ensureDir(p) {
  await fsp.mkdir(p, { recursive: true });
}

async function writeFile(p, body) {
  await ensureDir(path.dirname(p));
  await fsp.writeFile(p, body, "utf8");
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
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

describe("scenario runtime max steps", () => {
  it("stops when max_steps is exceeded", async () => {
    const root = await fsp.mkdtemp(
      path.join(os.tmpdir(), "uri-v2-max-steps-")
    );

    const uramRoot = path.join(root, "uram");
    const projectName = "testproj";
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
        "    - project",
        "",
        "runtime:",
        "  max_steps: 1",
        "  strict_commands: true",
        "",
      ].join("\n")
    );

    const runbookText = [
      "version: 1",
      `project: ${projectName}`,
      "steps:",
      "  - id: step_1",
      "    command: system.echo",
      "    args:",
      '      message: "one"',
      "  - id: step_2",
      "    command: system.echo",
      "    args:",
      '      message: "two"',
      "",
    ].join("\n");

    const tmpZipDir = path.join(root, "zip-src");
    await ensureDir(tmpZipDir);

    const builtInboxZip = zipRunbook(tmpZipDir, runbookText);

    const inboxDir = path.join(uramRoot, "Inbox");
    await ensureDir(inboxDir);

    const inboxZipPath = path.join(inboxDir, "inbox.zip");
    await fsp.copyFile(builtInboxZip, inboxZipPath);

    const result = await runUramPipeline({
      uramCli: uramRoot,
      workspaceCli: path.join(root, "workspace"),
      quiet: true,
      env: process.env,
      homeDir: os.homedir(),
    });

    expect(result.ok).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(result.project).toBe(projectName);
    expect(result.engine).toBe("scenario");

    expect(result.error).toBeDefined();
    expect(result.error.code).toBe("MAX_STEPS_EXCEEDED");
    expect(typeof result.error.message).toBe("string");
    expect(result.error.message.length).toBeGreaterThan(0);

    const projectBoxDir = getProjectBoxDir(uramRoot, projectName);
    const historyDir = getHistoryDir(projectBoxDir);
    const indexPath = path.join(historyDir, "index.json");
    const latestOutboxPath = getLatestOutboxPath(projectBoxDir);

    expect(fs.existsSync(indexPath)).toBe(true);
    expect(fs.existsSync(latestOutboxPath)).toBe(true);
    expect(fs.existsSync(inboxZipPath)).toBe(false);

    const historyIndex = readJson(indexPath);
    expect(Array.isArray(historyIndex)).toBe(true);
    expect(historyIndex.length).toBeGreaterThan(0);

    const lastEntry = historyIndex[historyIndex.length - 1];
    expect(lastEntry.runId).toBe(result.runId);
    expect(lastEntry.project).toBe(projectName);
    expect(lastEntry.executionKind).toBe("scenario");
    expect(lastEntry.exitCode).toBe(1);

    const latest = readJson(latestOutboxPath);
    expect(latest.ok).toBe(false);
    expect(latest.engine).toBe("scenario");
    expect(latest.error).toBeDefined();
    expect(latest.error.code).toBe("MAX_STEPS_EXCEEDED");
  });
});
