import { describe, it, expect } from "vitest";
import fs from "fs";
import fsp from "fs/promises";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";

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

describe("cli debug runbook", () => {
  it("prints runbook summary and compiled plan summary", async () => {
    const root = await fsp.mkdtemp(
      path.join(os.tmpdir(), "uri-cli-debug-runbook-")
    );

    const uramRoot = path.join(root, "uram");
    const projectName = "demo";
    const projectRoot = path.join(root, "projects", projectName);
    const tmpZipDir = path.join(root, "zip-src");

    await ensureDir(uramRoot);
    await ensureDir(projectRoot);
    await ensureDir(tmpZipDir);

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
      "  - id: step_echo_1",
      "    command: system.echo",
      "    args:",
      '      message: "hello runbook"',
      "  - id: step_echo_2",
      "    command: system.echo",
      "    args:",
      '      message: "hello runbook again"',
      "",
    ].join("\n");

    const inboxZipPath = zipRunbook(tmpZipDir, runbookText);
    const cliPath = path.resolve("src/cli.cjs");

    const output = execFileSync(
      process.execPath,
      [cliPath, "debug", "runbook", inboxZipPath],
      {
        env: {
          ...process.env,
          URI_URAM: uramRoot,
        },
        encoding: "utf8",
      }
    );

    expect(output).toContain("RUNBOOK");
    expect(output).toContain("version: 1");
    expect(output).toContain(`project: ${projectName}`);
    expect(output).toContain("steps: 2");

    expect(output).toContain("stepIds:");
    expect(output).toContain("step_echo_1");
    expect(output).toContain("step_echo_2");

    expect(output).toContain("commands:");
    expect(output).toContain("system.echo");

    expect(output).toContain("COMPILE SUMMARY");
    expect(output).toContain("runbook.steps: 2");
    expect(output).toContain("plan.steps: 2");
    expect(output).toContain("plan.engine: scenario");
    expect(output).toContain(`plan.project: ${projectName}`);
    expect(output).toContain("plan.runtime.strictCommands: true");
    expect(output).toContain("plan.runtime.maxSteps: 100");

    expect(output).toContain("PLAN");
    expect(output).toContain("0. step_echo_1 -> system.echo");
    expect(output).toContain("1. step_echo_2 -> system.echo");
  });
});
