import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { execSync } from "child_process";

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

function zipRunbook(tmpDir) {
  execSync("zip -j inbox.zip RUNBOOK.yaml", { cwd: tmpDir, stdio: "pipe" });
}

describe("scenario runtime max steps", () => {
  it("stops when max_steps is exceeded", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "uri-max-steps-"));
    const uram = path.join(tmp, "uram");
    const projectDir = path.join(tmp, "project");

    fs.mkdirSync(projectDir, { recursive: true });

    writeFile(
      path.join(projectDir, "contexts/system/executable.yaml"),
      `
version: 1

engine: scenario

commands:
  roots:
    - system

runtime:
  max_steps: 3
  strict_commands: true
`
    );

    writeFile(
      path.join(uram, "config/projects.yaml"),
      `
version: 1
projects:
  testproj:
    cwd: ${projectDir}
`
    );

    writeFile(
      path.join(tmp, "RUNBOOK.yaml"),
      `
version: 1
project: testproj

steps:
  - id: loop
    command: system.echo
    on_success: loop
`
    );

    zipRunbook(tmp);

    fs.mkdirSync(path.join(uram, "Inbox"), { recursive: true });
    fs.copyFileSync(
      path.join(tmp, "inbox.zip"),
      path.join(uram, "Inbox", "inbox.zip")
    );

    let failed = false;

    try {
      execSync(`uri run --uram ${uram}`, {
        cwd: process.cwd(),
        stdio: "pipe",
      });
    } catch (error) {
      failed = true;
    }

    expect(failed).toBe(true);

    const historyDir = path.join(uram, "testprojBox", "history");
    const files = fs.readdirSync(historyDir);
    const indexPath = path.join(historyDir, "index.jsonl");
    const indexRaw = fs.readFileSync(indexPath, "utf8").trim();
    const lines = indexRaw.split("\n").filter(Boolean);
    const lastEntry = JSON.parse(lines[lines.length - 1]);

    expect(files.length).toBeGreaterThan(0);
    expect(lastEntry.ok).toBe(false);
    expect(lastEntry.engine).toBe("scenario");
    expect(lastEntry.project).toBe("testproj");
  });
});
