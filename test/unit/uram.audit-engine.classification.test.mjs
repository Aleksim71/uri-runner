import { describe, it, expect } from "vitest";
import fs from "fs-extra";
import path from "path";
import os from "os";
import { execFileSync } from "node:child_process";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { runAuditEngine } = require("../../src/uram/engines/audit-engine.cjs");

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

describe("runAuditEngine classification integration", () => {
  it("propagates classification_required status and attaches tmpProvidedDir", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "uri-audit-engine-"));
    const repo = path.join(tmp, "repo");
    await fs.ensureDir(repo);

    const inboxZipPath = path.join(tmp, "inbox.zip");
    const tmpOutboxPath = path.join(tmp, ".tmp.outbox.json");
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

    makeZip(inboxZipPath, {
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

    const result = await runAuditEngine({
      projectCtx: { cwd: repo },
      inboxZipPath,
      tmpOutboxPath,
      workspaceRoot: path.join(tmp, "workspace"),
      executableCtx: {
        runtime: {
          command_registry: {
            enabled: true,
            path: registryPath,
          },
        },
      },
    });

    expect(result.exitCode).toBe(13);
    expect(result.outboxPayload.status).toBe("classification_required");
    expect(result.outboxPayload.audit.classification_required).toBe(true);
    expect(result.meta.error.code).toBe("CLASSIFICATION_REQUIRED");
    expect(typeof result.meta.tmpProvidedDir).toBe("string");
    expect(await fs.pathExists(path.join(result.meta.tmpProvidedDir, "provided", "classification-request.yaml"))).toBe(true);
  });
});
