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

describe("cli debug commands", () => {
  it("prints discovered commands for the runbook project", async () => {
    const root = await fsp.mkdtemp(
      path.join(os.tmpdir(), "uri-cli-debug-commands-")
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

    await writeFile(
      path.join(projectRoot, "contexts/project/commands/local-hello.cjs"),
      [
        '"use strict";',
        "",
        "module.exports = async function localHello() {",
        '  return { ok: true, source: "project" };',
        "};",
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
      '      message: "hello"',
      "",
    ].join("\n");

    const inboxZipPath = zipRunbook(tmpZipDir, runbookText);
    const cliPath = path.resolve("src/cli.cjs");

    const output = execFileSync(
      process.execPath,
      [cliPath, "debug", "commands", inboxZipPath],
      {
        env: {
          ...process.env,
          URI_URAM: uramRoot,
        },
        encoding: "utf8",
      }
    );

    expect(output).toContain("COMMANDS");
    expect(output).toContain(`project: ${projectName}`);
    expect(output).toContain("strictCommands: true");
    expect(output).toContain("roots: system, project");
    expect(output).toContain("system.echo");
    expect(output).toContain("project.local-hello");
  });
});
