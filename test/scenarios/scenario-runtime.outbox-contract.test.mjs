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

function unzipJson(zipPath, entryName) {
  const raw = execFileSync("unzip", ["-p", zipPath, entryName], {
    encoding: "utf8",
  });

  return JSON.parse(raw);
}

function unzipText(zipPath, entryName) {
  return execFileSync("unzip", ["-p", zipPath, entryName], {
    encoding: "utf8",
  });
}

function unzipList(zipPath) {
  return execFileSync("unzip", ["-Z1", zipPath], {
    encoding: "utf8",
  })
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .sort();
}

describe("scenario runtime outbox contract", () => {
  it("puts outbox.json and requested provided files into outbox.zip", async () => {
    const root = await fsp.mkdtemp(path.join(os.tmpdir(), "uri-v3-outbox-"));

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

    await writeFile(
      path.join(projectRoot, "report.txt"),
      ["alpha", "beta", "gamma", "delta", "epsilon"].join("\n")
    );

    const runbookText = [
      "version: 1",
      `project: ${projectName}`,
      "steps:",
      "  - id: step_echo_1",
      "    command: system.echo",
      "    args:",
      '      message: "hello outbox contract"',
      "provide:",
      "  - kind: file",
      "    path: report.txt",
      "  - kind: file_fragment",
      "    path: report.txt",
      "    lines: [2, 4]",
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

    expect(res.exitCode).toBe(0);

    const allFiles = await walk(uramRoot);
    const outboxFiles = allFiles.filter((p) => p.endsWith(".outbox.zip"));
    expect(outboxFiles.length).toBeGreaterThan(0);

    const latestOutbox = outboxFiles.sort().at(-1);
    const entries = unzipList(latestOutbox);

    expect(entries).toEqual([
      "outbox.json",
      "provided/fragments/report.txt_2_4.txt",
      "provided/report.txt",
    ]);

    const outbox = unzipJson(latestOutbox, "outbox.json");

    expect(outbox.status).toBe("success");
    expect(outbox.attempts).toBe(1);
    expect(outbox.provided).toEqual([
      {
        kind: "file",
        path: "provided/report.txt",
      },
      {
        kind: "file_fragment",
        path: "provided/fragments/report.txt_2_4.txt",
        source: "report.txt",
        lines: [2, 4],
      },
    ]);

    const deliveredFile = unzipText(latestOutbox, "provided/report.txt");
    expect(deliveredFile).toBe(["alpha", "beta", "gamma", "delta", "epsilon"].join("\n"));

    const deliveredFragment = unzipText(
      latestOutbox,
      "provided/fragments/report.txt_2_4.txt"
    );
    expect(deliveredFragment).toBe(["beta", "gamma", "delta"].join("\n"));
  });
});
