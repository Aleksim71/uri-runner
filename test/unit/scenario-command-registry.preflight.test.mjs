import { describe, expect, it } from "vitest";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const {
  preflightScenarioPlan,
} = require("../../src/runtime/scenario-command-registry/preflight-scenario-plan.cjs");

function buildRegistryYaml() {
  return [
    "version: 1",
    "named_commands:",
    "  - id: system.echo",
    "    match:",
    "      command: system.echo",
    "browser_actions:",
    "  - id: browser.page.open",
    "    match:",
    "      action: page.open",
    "",
  ].join("\n");
}

describe("scenario command registry preflight", () => {
  it("passes when all scenario steps are known in registry", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "uri-scenario-registry-"));
    const registryPath = path.join(root, "scenario-command-registry.yaml");
    await writeFile(registryPath, buildRegistryYaml(), "utf8");

    const result = preflightScenarioPlan({
      plan: {
        project: "demo",
        steps: [
          {
            kind: "command",
            stepId: "step_echo_1",
            command: "system.echo",
            args: { message: "hello" },
          },
          {
            kind: "browser",
            stepId: "step_open_1",
            action: "page.open",
            args: { url: "https://example.com" },
          },
        ],
      },
      registryPath,
      generatedAt: "2026-04-08T00:00:00.000Z",
    });

    expect(result.status).toBe("ok");
    expect(result.matchedSteps).toHaveLength(2);
    expect(result.unknownSteps).toHaveLength(0);
    expect(result.classificationRequest).toBeNull();
  });

  it("returns classification_required for unknown named command and browser action", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "uri-scenario-registry-"));
    const registryPath = path.join(root, "scenario-command-registry.yaml");
    await writeFile(registryPath, buildRegistryYaml(), "utf8");

    const result = preflightScenarioPlan({
      plan: {
        project: "demo",
        steps: [
          {
            kind: "command",
            stepId: "step_unknown_cmd",
            command: "system.unknown",
            args: {},
          },
          {
            kind: "browser",
            stepId: "step_unknown_browser",
            action: "page.magic",
            args: {},
          },
        ],
      },
      registryPath,
      generatedAt: "2026-04-08T00:00:00.000Z",
    });

    expect(result.status).toBe("classification_required");
    expect(result.matchedSteps).toHaveLength(0);
    expect(result.unknownSteps).toHaveLength(2);
    expect(result.classificationRequest).toMatchObject({
      status: "classification_required",
      engine: "scenario",
      registry_path: registryPath,
    });
    expect(result.classificationRequest.unknown_steps).toHaveLength(2);
    expect(result.classificationRequest.unknown_steps[0]).toMatchObject({
      kind: "command",
      command: "system.unknown",
    });
    expect(result.classificationRequest.unknown_steps[1]).toMatchObject({
      kind: "browser",
      action: "page.magic",
    });
  });

  it("preserves matched steps while requesting classification only for unknown browser action", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "uri-scenario-registry-"));
    const registryPath = path.join(root, "scenario-command-registry.yaml");
    await writeFile(registryPath, buildRegistryYaml(), "utf8");

    const result = preflightScenarioPlan({
      plan: {
        project: "demo",
        steps: [
          {
            kind: "command",
            stepId: "step_echo_1",
            command: "system.echo",
            args: { message: "hello" },
          },
          {
            kind: "browser",
            stepId: "step_browser_unknown_1",
            action: "page.capture",
            args: { fullPage: true, path: "shot.png" },
          },
        ],
      },
      registryPath,
      generatedAt: "2026-04-08T00:00:00.000Z",
    });

    expect(result.status).toBe("classification_required");
    expect(result.matchedSteps).toHaveLength(1);
    expect(result.matchedSteps[0]).toMatchObject({
      kind: "command",
      command: "system.echo",
      registryId: "system.echo",
    });
    expect(result.unknownSteps).toHaveLength(1);
    expect(result.classificationRequest.unknown_steps).toEqual([
      expect.objectContaining({
        kind: "browser",
        action: "page.capture",
        args_keys: ["fullPage", "path"],
        suggested_match: {
          action: "page.capture",
        },
      }),
    ]);
  });
});
