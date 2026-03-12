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

describe("cli compile", () => {
  it("compiles inbox.zip into a canonical plan artifact", async () => {
    const root = await fsp.mkdtemp(
      path.join(os.tmpdir(), "uri-cli-compile-")
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
      '      message: "hello compile"',
      "  - id: step_echo_2",
      "    command: system.echo",
      "    args:",
      '      message: "hello compile again"',
      "",
    ].join("\n");

    const inboxZipPath = zipRunbook(tmpZipDir, runbookText);
    const planPath = path.join(root, "artifacts", "plan.json");
    const cliPath = path.resolve("src/cli.cjs");

    const output = execFileSync(
      process.execPath,
      [cliPath, "compile", inboxZipPath, planPath],
      {
        env: {
          ...process.env,
          URI_URAM: uramRoot,
        },
        encoding: "utf8",
      }
    );

    expect(output).toContain("[uri] plan written:");
    expect(output).toContain("[uri] bytes:");

    expect(fs.existsSync(planPath)).toBe(true);

    const rawPlan = await fsp.readFile(planPath, "utf8");
    const plan = JSON.parse(rawPlan);

    expect(plan.version).toBe(1);
    expect(plan.kind).toBe("scenario-plan");
    expect(plan.engine).toBe("scenario");
    expect(plan.project).toBe(projectName);

    expect(plan.runtime).toBeDefined();
    expect(plan.runtime.strictCommands).toBe(true);
    expect(plan.runtime.maxSteps).toBe(100);

    expect(Array.isArray(plan.steps)).toBe(true);
    expect(plan.steps).toHaveLength(2);

    expect(plan.steps[0]).toMatchObject({
      kind: "command",
      index: 0,
      stepId: "step_echo_1",
      command: "system.echo",
      commandRoot: "system",
      args: {
        message: "hello compile",
      },
    });

    expect(plan.steps[1]).toMatchObject({
      kind: "command",
      index: 1,
      stepId: "step_echo_2",
      command: "system.echo",
      commandRoot: "system",
      args: {
        message: "hello compile again",
      },
    });
  });
});
