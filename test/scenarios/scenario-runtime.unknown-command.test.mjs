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
  getProcessedDir,
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

describe("scenario runtime unknown command", () => {
  it("finalizes run when strict_commands is true and command is unknown", async () => {
    const root = await fsp.mkdtemp(
      path.join(os.tmpdir(), "uri-v2-unknown-command-")
    );

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
        "    - project",
        "",
        "runtime:",
        "  max_steps: 100",
        "  strict_commands: true",
        "",
      ].join("\n")
    );

    const runbookText = [
      "version: 1",
      `project: ${projectName}`,
      "steps:",
      "  - id: step_missing_1",
      "    command: system.not_found_command",
      "    args:",
      '      message: "should fail"',
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

    console.dir(result, { depth: null });

    expect(result.ok).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(result.project).toBe(projectName);
    expect(result.engine).toBe("scenario");

    expect(result.error).toBeDefined();
    expect(typeof result.error.code).toBe("string");
    expect(result.error.code.length).toBeGreaterThan(0);
    expect(result.error.code).toBe("COMMAND_NOT_FOUND");
    expect(typeof result.error.message).toBe("string");
    expect(result.error.message.length).toBeGreaterThan(0);

    const processedDir = getProcessedDir(uramRoot);
    const projectBoxDir = getProjectBoxDir(uramRoot, projectName);
    const latestOutboxPath = getLatestOutboxPath(projectBoxDir);
    const historyDir = getHistoryDir(projectBoxDir);
    const indexPath = path.join(historyDir, "index.json");

    expect(fs.existsSync(latestOutboxPath)).toBe(true);
    expect(fs.existsSync(indexPath)).toBe(true);
    expect(fs.existsSync(inboxZipPath)).toBe(false);

    const processedFiles = fs
      .readdirSync(processedDir)
      .filter((name) => name.endsWith(".inbox.zip"));

    expect(processedFiles.length).toBe(1);
    expect(processedFiles[0]).toContain(
      `__${projectName}__${result.runId}.inbox.zip`
    );

    const latest = readJson(latestOutboxPath);
    expect(latest.ok).toBe(false);
    expect(latest.engine).toBe("scenario");
    expect(latest.error).toBeDefined();
    expect(typeof latest.error.code).toBe("string");
    expect(latest.error.code.length).toBeGreaterThan(0);
    expect(latest.error.code).toBe("COMMAND_NOT_FOUND");
    expect(typeof latest.error.message).toBe("string");

    const historyIndex = readJson(indexPath);
    expect(Array.isArray(historyIndex)).toBe(true);
    expect(historyIndex.length).toBeGreaterThan(0);

    const lastEntry = historyIndex[historyIndex.length - 1];
    expect(lastEntry.runId).toBe(result.runId);
    expect(lastEntry.project).toBe(projectName);
    expect(lastEntry.executionKind).toBe("scenario");
    expect(lastEntry.exitCode).toBe(1);
  });
});
