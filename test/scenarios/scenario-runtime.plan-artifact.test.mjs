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
} = require("../../src/uram/paths.cjs");
const {
  getLatestPlanPath,
  getHistoryPlanPath,
} = require("../../src/uram/plan-paths.cjs");

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

describe("scenario runtime plan artifact", () => {
  it("persists compiled plan during normal uri run", async () => {
    const root = await fsp.mkdtemp(
      path.join(os.tmpdir(), "uri-v3-plan-artifact-")
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
      "  - id: step_echo_1",
      "    command: system.echo",
      "    args:",
      '      message: "hello plan artifact"',
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

    expect(result.ok).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.project).toBe(projectName);
    expect(result.engine).toBe("scenario");
    expect(result.plan).toBeDefined();
    expect(result.plan.path).toBe(`history/plans/${result.runId}.plan.json`);

    const projectBoxDir = getProjectBoxDir(uramRoot, projectName);
    const historyDir = getHistoryDir(projectBoxDir);
    const latestPlanPath = getLatestPlanPath(projectBoxDir);
    const historyPlanPath = getHistoryPlanPath(historyDir, result.runId);

    expect(fs.existsSync(latestPlanPath)).toBe(true);
    expect(fs.existsSync(historyPlanPath)).toBe(true);

    const latestPlan = readJson(latestPlanPath);
    const historyPlan = readJson(historyPlanPath);

    expect(latestPlan.version).toBe(1);
    expect(latestPlan.kind).toBe("scenario-plan");
    expect(latestPlan.engine).toBe("scenario");
    expect(latestPlan.project).toBe(projectName);
    expect(Array.isArray(latestPlan.steps)).toBe(true);
    expect(latestPlan.steps).toHaveLength(1);
    expect(latestPlan.steps[0]).toMatchObject({
      kind: "command",
      index: 0,
      stepId: "step_echo_1",
      command: "system.echo",
      commandRoot: "system",
      args: {
        message: "hello plan artifact",
      },
    });

    expect(historyPlan).toEqual(latestPlan);
  });
});
