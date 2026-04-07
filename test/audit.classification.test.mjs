import { describe, it, expect } from "vitest";
import fs from "fs-extra";
import path from "path";
import os from "os";
import unzipper from "unzipper";
import { execFileSync } from "node:child_process";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { runAudit } = require("../src/commands/context/audit.cjs");

async function unzipToMem(zipPath) {
  const dir = await unzipper.Open.file(zipPath);
  const names = dir.files.map((f) => f.path);
  const getText = async (name) => {
    const file = dir.files.find((entry) => entry.path === name);
    if (!file) return null;
    const buffer = await file.buffer();
    return buffer.toString("utf8");
  };
  return { names, getText };
}

function makeZip(zipPath, files) {
  const filePaths = Object.entries(files).map(([name, content]) => {
    const dir = path.dirname(zipPath);
    const filePath = path.join(dir, name);
    fs.ensureDirSync(path.dirname(filePath));
    fs.writeFileSync(filePath, content, "utf8");
    return filePath;
  });

  execFileSync("zip", ["-q", "-j", zipPath, ...filePaths], {
    cwd: path.dirname(zipPath),
  });
}

describe("audit classification", () => {
  it("returns classification_required and writes request artifacts when unknown commands are blocked", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "uri-audit-classification-"));
    const repo = path.join(tmp, "repo");
    await fs.ensureDir(repo);

    const inboxDir = path.join(repo, "artifacts", "inbox");
    const outboxDir = path.join(repo, "artifacts", "outbox");
    await fs.ensureDir(inboxDir);
    await fs.ensureDir(outboxDir);

    const registryPath = path.join(tmp, "command-registry.yaml");
    await fs.writeFile(
      registryPath,
      [
        "version: 1",
        "defaults:",
        "  on_unknown: classification_required",
        "  generate_request: true",
        "  execute_unknown: false",
        "commands:",
        "  - id: inspect.pwd",
        "    group: inspect",
        "    profile: instant",
        "    match:",
        "      cmd: pwd",
        "",
      ].join("\n"),
      "utf8"
    );

    const inboxZip = path.join(inboxDir, "inbox.zip");
    const outboxZip = path.join(outboxDir, "outbox.zip");

    makeZip(inboxZip, {
      "RUNBOOK.yaml": [
        "version: 1",
        "audit:",
        "  checks:",
        "    - name: migrate",
        "      cmd: npm",
        "      args: [run, migrate]",
        "",
      ].join("\n"),
    });

    const res = await runAudit({
      cwd: repo,
      inboxPath: inboxZip,
      outboxPath: outboxZip,
      workspaceDir: path.join(repo, ".runner-work"),
      commandRegistry: {
        enabled: true,
        registryPath,
      },
    });

    expect(res.exitCode).toBe(13);
    expect(res.status.classification_required).toBe(true);
    expect(res.error.code).toBe("CLASSIFICATION_REQUIRED");
    expect(await fs.pathExists(outboxZip)).toBe(true);

    const z = await unzipToMem(outboxZip);
    expect(z.names).toContain("SNAPSHOT.txt");
    expect(z.names).toContain("STATUS.json");
    expect(z.names).toContain("REPORT/classification-request.yaml");
    expect(z.names).toContain("REPORT/classification-request.json");

    const statusText = await z.getText("STATUS.json");
    const status = JSON.parse(statusText);
    expect(status.classification_required).toBe(true);
    expect(status.errors[0].code).toBe("CLASSIFICATION_REQUIRED");
    expect(status.classification_request.unknown_commands[0].cmd).toBe("npm");
  });
});
