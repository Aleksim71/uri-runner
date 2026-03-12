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

async function exists(p) {
  try {
    await fsp.access(p, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function walk(dir) {
  const out = [];
  const entries = await fsp.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walk(full)));
    } else {
      out.push(full);
    }
  }

  return out;
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

describe("scenario runtime smoke", () => {
  it("executes scenario command and writes outbox", async () => {
    const root = await fsp.mkdtemp(path.join(os.tmpdir(), "uri-v2-smoke-"));

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

    // Important: current parser requires step.id
    const runbookText = [
      "version: 1",
      `project: ${projectName}`,
      "steps:",
      "  - id: step_echo_1",
      "    command: system.echo",
      "    args:",
      '      message: "hello from smoke"',
      "",
    ].join("\n");

    const tmpZipDir = path.join(root, "zip-src");
    await ensureDir(tmpZipDir);

    const builtInboxZip = zipRunbook(tmpZipDir, runbookText);

    const inboxDir = path.join(uramRoot, "Inbox");
    await ensureDir(inboxDir);

    const inboxZipPath = path.join(inboxDir, "inbox.zip");
    await fsp.copyFile(builtInboxZip, inboxZipPath);

    const res = await runUramPipeline({
      uramCli: uramRoot,
      workspaceCli: path.join(root, "workspace"),
      quiet: true,
      env: process.env,
      homeDir: os.homedir(),
    });

    console.dir(res, { depth: null });

    expect(res.exitCode).toBe(0);

    const allFiles = await walk(uramRoot);

    const outboxFiles = allFiles.filter((p) => p.endsWith(".outbox.zip"));
    expect(outboxFiles.length).toBeGreaterThan(0);

    const latestOutbox = outboxFiles.sort().at(-1);
    const outboxRaw = await fsp.readFile(latestOutbox, "utf8");
    const outbox = JSON.parse(outboxRaw);

    expect(outbox.ok).toBe(true);
    expect(outbox.engine).toBe("scenario");
    expect(outbox.project).toBe(projectName);
    expect(outbox.loaded_commands).toContain("system.echo");
    expect(outbox.result).toBeTruthy();

    const processedInboxFiles = allFiles.filter((p) => p.endsWith(".inbox.zip"));
    expect(processedInboxFiles.length).toBeGreaterThan(0);

    const originalInboxStillExists = await exists(inboxZipPath);
    expect(originalInboxStillExists).toBe(false);
  });
});
