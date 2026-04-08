import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const { runPlan } = require("../../src/uram/run-plan.cjs");
const {
  PLAN_VERSION,
  PLAN_KIND_SCENARIO,
} = require("../../src/uram/plan-schema.cjs");

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

describe("run-plan scenario classification preflight", () => {
  it("returns classification_required before executing unknown named command when registry is enabled", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "uri-run-plan-scenario-classification-"));
    const projectRoot = path.join(root, "project");
    await mkdir(projectRoot, { recursive: true });

    const registryPath = path.join(root, "scenario-command-registry.yaml");
    await writeFile(registryPath, buildRegistryYaml(), "utf8");

    const plan = {
      version: PLAN_VERSION,
      kind: PLAN_KIND_SCENARIO,
      engine: "scenario",
      project: "demo",
      runtime: {
        strictCommands: true,
        maxSteps: 100,
      },
      executableCtxSnapshot: {
        engine: "scenario",
        commands: {
          roots: ["system"],
        },
        runtime: {
          max_steps: 100,
          strict_commands: true,
          scenario_command_registry: {
            enabled: true,
            path: registryPath,
          },
        },
      },
      steps: [
        {
          kind: "command",
          index: 0,
          stepId: "step_missing_1",
          command: "system.unknown",
          commandRoot: "system",
          args: {},
        },
      ],
    };

    const result = await runPlan({
      plan,
      projectRoot,
      runId: "test-run-id",
      workspaceDir: path.join(root, "workspace"),
    });

    expect(result.exitCode).toBe(1);
    expect(result.outboxPayload.ok).toBe(false);
    expect(result.outboxPayload.status).toBe("classification_required");
    expect(result.outboxPayload.classification_request).toMatchObject({
      status: "classification_required",
      engine: "scenario",
    });
    expect(result.meta.error).toMatchObject({
      code: "CLASSIFICATION_REQUIRED",
    });
  });

  it("still executes known command when scenario registry is enabled", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "uri-run-plan-scenario-classification-"));
    const projectRoot = path.join(root, "project");
    await mkdir(projectRoot, { recursive: true });

    const registryPath = path.join(root, "scenario-command-registry.yaml");
    await writeFile(registryPath, buildRegistryYaml(), "utf8");

    const plan = {
      version: PLAN_VERSION,
      kind: PLAN_KIND_SCENARIO,
      engine: "scenario",
      project: "demo",
      runtime: {
        strictCommands: true,
        maxSteps: 100,
      },
      executableCtxSnapshot: {
        engine: "scenario",
        commands: {
          roots: ["system"],
        },
        runtime: {
          max_steps: 100,
          strict_commands: true,
          scenario_command_registry: {
            enabled: true,
            path: registryPath,
          },
        },
      },
      steps: [
        {
          kind: "command",
          index: 0,
          stepId: "step_echo_1",
          command: "system.echo",
          commandRoot: "system",
          args: {
            message: "hello",
          },
        },
      ],
    };

    const result = await runPlan({
      plan,
      projectRoot,
      runId: "test-run-id",
      workspaceDir: path.join(root, "workspace"),
    });

    expect(result.exitCode).toBe(0);
    expect(result.outboxPayload.ok).toBe(true);
    expect(result.outboxPayload.status ?? "success").toBe("success");
  });

  it("blocks the whole scenario before execution when an unknown browser action is present", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "uri-run-plan-scenario-classification-"));
    const projectRoot = path.join(root, "project");
    await mkdir(projectRoot, { recursive: true });

    const registryPath = path.join(root, "scenario-command-registry.yaml");
    await writeFile(registryPath, buildRegistryYaml(), "utf8");

    const plan = {
      version: PLAN_VERSION,
      kind: PLAN_KIND_SCENARIO,
      engine: "scenario",
      project: "demo",
      runtime: {
        strictCommands: true,
        maxSteps: 100,
      },
      executableCtxSnapshot: {
        engine: "scenario",
        commands: {
          roots: ["system", "browser"],
        },
        runtime: {
          max_steps: 100,
          strict_commands: true,
          scenario_command_registry: {
            enabled: true,
            path: registryPath,
          },
        },
      },
      steps: [
        {
          kind: "command",
          index: 0,
          stepId: "step_echo_1",
          command: "system.echo",
          commandRoot: "system",
          args: {
            message: "must not execute before classification",
          },
        },
        {
          kind: "browser",
          index: 1,
          stepId: "step_browser_unknown_1",
          command: "browser.page.capture",
          commandRoot: "browser",
          action: "page.capture",
          args: {
            fullPage: true,
          },
        },
      ],
    };

    const result = await runPlan({
      plan,
      projectRoot,
      runId: "test-run-id",
      workspaceDir: path.join(root, "workspace"),
    });

    expect(result.exitCode).toBe(1);
    expect(result.outboxPayload.status).toBe("classification_required");
    expect(result.outboxPayload.result.results).toEqual([]);
    expect(result.meta.error).toMatchObject({
      code: "CLASSIFICATION_REQUIRED",
    });
    expect(result.outboxPayload.classification_request).toMatchObject({
      status: "classification_required",
      unknown_steps: [
        expect.objectContaining({
          kind: "browser",
          action: "page.capture",
        }),
      ],
    });
  });
});
