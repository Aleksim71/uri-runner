import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { describe, expect, it } from "vitest";

import { runUramPipeline } from "../../src/uram/pipeline.cjs";
import {
  getProcessedDir,
  getProjectBoxDir,
  getHistoryDir,
  getLatestOutboxPath,
} from "../../src/uram/paths.cjs";

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function zipSingleFile(zipPath, filePath) {
  fs.mkdirSync(path.dirname(zipPath), { recursive: true });
  execFileSync("zip", ["-j", zipPath, filePath], {
    stdio: "ignore",
  });
}

describe("scenario runtime root policy", () => {
  it("finalizes run when command root is not allowed", async () => {
    const tempRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "uri-scenario-root-policy-")
    );

    const uramRoot = path.join(tempRoot, "uram");
    const inboxDir = path.join(uramRoot, "Inbox");
    const processedDir = getProcessedDir(uramRoot);
    const projectsRoot = path.join(uramRoot, "projects");

    const projectName = "demo";
    const projectDir = path.join(projectsRoot, projectName);

    fs.mkdirSync(inboxDir, { recursive: true });
    fs.mkdirSync(processedDir, { recursive: true });
    fs.mkdirSync(projectDir, { recursive: true });

    writeFile(
      path.join(projectDir, "package.json"),
      JSON.stringify(
        {
          name: "demo",
          version: "1.0.0",
        },
        null,
        2
      )
    );

    writeFile(
      path.join(projectDir, "contexts/system/executable.yaml"),
      `
version: 1
engine: scenario

commands:
  roots:
    - project

runtime:
  max_steps: 100
  strict_commands: true
`.trim() + "\n"
    );

    const runbookPath = path.join(tempRoot, "RUNBOOK.yaml");
    writeFile(
      runbookPath,
      `
version: 1

meta:
  project: ${projectName}

execution:
  kind: scenario

steps:
  - id: step_1
    command: system.echo
    args:
      text: "should fail by root policy"
`.trim() + "\n"
    );

    const inboxZipPath = path.join(inboxDir, "inbox.zip");
    zipSingleFile(inboxZipPath, runbookPath);

    const result = await runUramPipeline({
      uramCli: uramRoot,
      workspaceCli: path.join(tempRoot, "workspace"),
      quiet: true,
      env: process.env,
      homeDir: os.homedir(),
    });

    expect(result.ok).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(result.project).toBe(projectName);
    expect(result.engine).toBe("scenario");

    expect(result.error).toBeDefined();
    expect(typeof result.error.code).toBe("string");
    expect(result.error.code.length).toBeGreaterThan(0);
    expect(typeof result.error.message).toBe("string");
    expect(result.error.message.length).toBeGreaterThan(0);

    const projectBoxDir = getProjectBoxDir(uramRoot, projectName);
    const latestOutboxPath = getLatestOutboxPath(projectBoxDir);
    const historyDir = getHistoryDir(projectBoxDir);
    const indexPath = path.join(historyDir, "index.json");

    expect(fs.existsSync(latestOutboxPath)).toBe(true);
    expect(fs.existsSync(indexPath)).toBe(true);
    expect(fs.existsSync(inboxZipPath)).toBe(false);

    // processed inbox name now includes stamp + project + runId
    const processedFiles = fs
      .readdirSync(processedDir)
      .filter((name) => name.endsWith(".inbox.zip"));

    expect(processedFiles.length).toBe(1);
    expect(processedFiles[0]).toContain(`__${projectName}__${result.runId}.inbox.zip`);

    const latest = readJson(latestOutboxPath);
    expect(latest.ok).toBe(false);
    expect(latest.engine).toBe("scenario");
    expect(latest.error).toBeDefined();
    expect(typeof latest.error.code).toBe("string");
    expect(latest.error.code.length).toBeGreaterThan(0);
    expect(typeof latest.error.message).toBe("string");
    expect(latest.error.message.length).toBeGreaterThan(0);

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
