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

function buildRegistryYamlWithoutSystemEcho() {
  return [
    "version: 1",
    "named_commands:",
    "browser_actions:",
    "  - id: browser.page.open",
    "    match:",
    "      action: page.open",
    "",
  ].join("\n");
}

describe("run-plan scenario classification response", () => {
  it("applies classification response for unknown named command and executes the scenario", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "uri-run-plan-scenario-response-"));
    const projectRoot = path.join(root, "project");
    await mkdir(projectRoot, { recursive: true });

    const registryPath = path.join(root, "scenario-command-registry.yaml");
    await writeFile(registryPath, buildRegistryYamlWithoutSystemEcho(), "utf8");

    const responsePath = path.join(root, "scenario-classification-response.yaml");
    await writeFile(
      responsePath,
      [
        "classifications:",
        "  - id: system.echo",
        "    group: system",
        "    profile: instant",
        "    match:",
        "      command: system.echo",
        "    args_schema:",
        "      required: [message]",
        "",
      ].join("\n"),
      "utf8"
    );

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
            classification_response_path: responsePath,
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
            message: "hello from response",
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
    expect(result.outboxPayload.result.results).toHaveLength(1);
    expect(result.outboxPayload.result.results[0]).toEqual(
      expect.objectContaining({
        stepId: "step_echo_1",
        command: "system.echo",
        ok: true,
      })
    );
    expect(result.meta.classificationResponse).toMatchObject({
      ok: true,
      added: 1,
      processed: 1,
    });
  });
});
