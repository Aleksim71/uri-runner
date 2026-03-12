import { describe, it, expect } from "vitest";
import fs from "fs";
import fsp from "fs/promises";
import os from "os";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

const { runPlan } = require("../../src/uram/run-plan.cjs");
const {
  PLAN_VERSION,
  PLAN_KIND_SCENARIO,
} = require("../../src/uram/plan-schema.cjs");

async function ensureDir(p) {
  await fsp.mkdir(p, { recursive: true });
}

async function writeFile(p, body) {
  await ensureDir(path.dirname(p));
  await fsp.writeFile(p, body, "utf8");
}

describe("run-plan scenario", () => {
  it("executes a compiled scenario plan", async () => {
    const root = await fsp.mkdtemp(
      path.join(os.tmpdir(), "uri-run-plan-scenario-")
    );

    const projectRoot = path.join(root, "project");
    await ensureDir(projectRoot);

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
            message: "hello from run-plan",
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
    expect(result.outboxPayload).toBeDefined();
    expect(result.outboxPayload.ok).toBe(true);
    expect(result.outboxPayload.engine).toBe("scenario");
    expect(result.outboxPayload.project).toBe("demo");
    expect(result.outboxPayload.loaded_commands).toContain("system.echo");
    expect(result.outboxPayload.result).toBeDefined();
    expect(Array.isArray(result.outboxPayload.result.results)).toBe(true);
    expect(result.outboxPayload.result.results).toHaveLength(1);

    expect(result.meta).toBeDefined();
    expect(Array.isArray(result.meta.loadedCommands)).toBe(true);
    expect(result.meta.loadedCommands).toContain("system.echo");
  });

  it("throws when strictCommands is true and command is missing", async () => {
    const root = await fsp.mkdtemp(
      path.join(os.tmpdir(), "uri-run-plan-missing-command-")
    );

    const projectRoot = path.join(root, "project");
    await ensureDir(projectRoot);

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
        },
      },
      steps: [
        {
          kind: "command",
          index: 0,
          stepId: "step_missing_1",
          command: "system.not_found_command",
          commandRoot: "system",
          args: {},
        },
      ],
    };

    await expect(
      runPlan({
        plan,
        projectRoot,
        runId: "test-run-id",
        workspaceDir: path.join(root, "workspace"),
      })
    ).rejects.toMatchObject({
      code: "COMMAND_NOT_FOUND",
    });
  });

  it("loads project commands from project contexts", async () => {
    const root = await fsp.mkdtemp(
      path.join(os.tmpdir(), "uri-run-plan-project-command-")
    );

    const projectRoot = path.join(root, "project");
    await ensureDir(projectRoot);

    await writeFile(
      path.join(projectRoot, "contexts/project/commands/local-hello.cjs"),
      [
        '"use strict";',
        "",
        "module.exports = async function localHello(payload) {",
        "  return {",
        "    ok: true,",
        '    command: payload.command,',
        '    from: "project",',
        "  };",
        "};",
        "",
      ].join("\n")
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
          roots: ["project"],
        },
        runtime: {
          max_steps: 100,
          strict_commands: true,
        },
      },
      steps: [
        {
          kind: "command",
          index: 0,
          stepId: "step_local_1",
          command: "project.local-hello",
          commandRoot: "project",
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

    expect(result.exitCode).toBe(0);
    expect(result.outboxPayload.ok).toBe(true);
    expect(result.outboxPayload.loaded_commands).toContain(
      "project.local-hello"
    );
    expect(result.meta.loadedCommands).toContain("project.local-hello");
  });
});
