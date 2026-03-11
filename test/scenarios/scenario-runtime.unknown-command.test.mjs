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

describe("scenario runtime unknown command", () => {
  it("fails when strict_commands is true and command is unknown", async () => {
    const root = await fsp.mkdtemp(path.join(os.tmpdir(), "uri-v2-unknown-command-"));

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

    await expect(
      runUramPipeline({
        uramCli: uramRoot,
        workspaceCli: path.join(root, "workspace"),
        quiet: true,
        env: process.env,
        homeDir: os.homedir(),
      })
    ).rejects.toThrow();
  });
});
