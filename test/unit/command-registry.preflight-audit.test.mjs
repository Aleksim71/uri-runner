import { describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

const {
  preflightAuditRunbook,
} = require("../../src/runtime/command-registry/preflight-audit-runbook.cjs");

function writeRegistry(tempDir, body) {
  const registryPath = path.join(tempDir, "command-registry.yaml");
  fs.writeFileSync(registryPath, body, "utf8");
  return registryPath;
}

describe("preflightAuditRunbook", () => {
  it("matches known audit commands from registry", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "uri-registry-"));
    const registryPath = writeRegistry(
      tempDir,
      [
        "version: 1",
        "defaults:",
        "  on_unknown: classification_required",
        "  generate_request: true",
        "  execute_unknown: false",
        "commands:",
        "  - id: node.inline",
        "    group: test",
        "    profile: instant",
        "    match:",
        "      cmd: node",
        "      args_prefix: [-e]",
        "  - id: server.node",
        "    group: server",
        "    profile: readiness",
        "    match:",
        "      cmd: node",
        "      args_prefix: [server.js]",
        "",
      ].join("\n")
    );

    const runbook = {
      version: 1,
      project: "demo",
      audit: {
        checks: [
          {
            name: "smoke",
            cmd: "node",
            args: ["-e", "console.log('ok')"],
          },
        ],
        server: {
          cmd: "node",
          args: ["server.js"],
          base_url: "http://127.0.0.1:3000",
          readiness: {
            path: "/healthz",
          },
        },
      },
    };

    const result = preflightAuditRunbook({
      runbook,
      registryPath,
      generatedAt: "2026-04-07T00:00:00.000Z",
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe("ok");
    expect(result.matchedCommands).toHaveLength(2);
    expect(result.unknownCommands).toHaveLength(0);
    expect(result.classificationRequest).toBeNull();
  });

  it("builds classification request for unknown audit commands", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "uri-registry-"));
    const registryPath = writeRegistry(
      tempDir,
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
      ].join("\n")
    );

    const runbook = {
      version: 1,
      project: "demo",
      audit: {
        checks: [
          {
            name: "migrate",
            cmd: "npm",
            args: ["run", "migrate"],
          },
        ],
      },
    };

    const result = preflightAuditRunbook({
      runbook,
      registryPath,
      generatedAt: "2026-04-07T00:00:00.000Z",
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe("classification_required");
    expect(result.matchedCommands).toHaveLength(0);
    expect(result.unknownCommands).toHaveLength(1);
    expect(result.classificationRequest).toBeTruthy();
    expect(result.classificationRequest.status).toBe("classification_required");
    expect(result.classificationRequest.unknown_commands[0].cmd).toBe("npm");
    expect(result.classificationRequest.unknown_commands[0].args).toEqual(["run", "migrate"]);
  });
});
