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

describe("scenario runtime root policy", () => {
  it("fails when command root is not allowed", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "uri-root-policy-"));
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
  max_steps: 10
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
  - id: bad
    command: project.some_command
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
    } catch {
      failed = true;
    }

    expect(failed).toBe(true);

    const projectBoxDir = path.join(uram, "testprojBox");
    const historyDir = path.join(projectBoxDir, "history");
    const latestOutboxPath = path.join(projectBoxDir, "outbox.latest.zip");
    const indexPath = path.join(historyDir, "index.jsonl");
    const inboxZipPath = path.join(uram, "Inbox", "inbox.zip");

    expect(fs.existsSync(projectBoxDir)).toBe(true);
    expect(fs.existsSync(historyDir)).toBe(true);

    // В текущей архитектуре policy failure происходит до finalizeRun,
    // поэтому latest outbox и history index могут не появиться.
    expect(fs.existsSync(latestOutboxPath)).toBe(false);
    expect(fs.existsSync(indexPath)).toBe(false);

    // Inbox тоже остаётся на месте, потому что finalizeRun не был вызван.
    expect(fs.existsSync(inboxZipPath)).toBe(true);
  });
});
