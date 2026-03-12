import { describe, it, expect } from "vitest";
import fs from "fs";
import fsp from "fs/promises";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";

async function ensureDir(p) {
  await fsp.mkdir(p, { recursive: true });
}

async function writeFile(p, body) {
  await ensureDir(path.dirname(p));
  await fsp.writeFile(p, body, "utf8");
}

describe("cli run-plan", () => {
  it("runs a compiled plan artifact and prints outbox payload", async () => {
    const root = await fsp.mkdtemp(
      path.join(os.tmpdir(), "uri-cli-run-plan-")
    );

    const uramRoot = path.join(root, "uram");
    const projectName = "demo";
    const projectRoot = path.join(root, "projects", projectName);
    const planPath = path.join(root, "artifacts", "plan.json");
    const workspaceDir = path.join(root, "workspace");

    await ensureDir(uramRoot);
    await ensureDir(projectRoot);
    await ensureDir(workspaceDir);

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

    const plan = {
      version: 1,
      kind: "scenario-plan",
      engine: "scenario",
      project: projectName,
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
            message: "hello from cli run-plan",
          },
        },
      ],
    };

    await writeFile(planPath, JSON.stringify(plan, null, 2));

    const cliPath = path.resolve("src/cli.cjs");

    const output = execFileSync(
      process.execPath,
      [cliPath, "run-plan", planPath],
      {
        env: {
          ...process.env,
          URI_URAM: uramRoot,
          URI_WORKSPACE: workspaceDir,
        },
        encoding: "utf8",
      }
    );

    const payload = JSON.parse(output);

    expect(payload.ok).toBe(true);
    expect(payload.engine).toBe("scenario");
    expect(payload.project).toBe(projectName);
    expect(Array.isArray(payload.loaded_commands)).toBe(true);
    expect(payload.loaded_commands).toContain("system.echo");

    expect(payload.result).toBeDefined();
    expect(Array.isArray(payload.result.results)).toBe(true);
    expect(payload.result.results).toHaveLength(1);

    expect(payload.result.results[0]).toMatchObject({
      stepId: "step_echo_1",
      command: "system.echo",
      ok: true,
    });
  });

  it("fails when plan references a missing command", async () => {
    const root = await fsp.mkdtemp(
      path.join(os.tmpdir(), "uri-cli-run-plan-missing-command-")
    );

    const uramRoot = path.join(root, "uram");
    const projectName = "demo";
    const projectRoot = path.join(root, "projects", projectName);
    const planPath = path.join(root, "artifacts", "bad-plan.json");
    const workspaceDir = path.join(root, "workspace");

    await ensureDir(uramRoot);
    await ensureDir(projectRoot);
    await ensureDir(workspaceDir);

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

    const badPlan = {
      version: 1,
      kind: "scenario-plan",
      engine: "scenario",
      project: projectName,
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

    await writeFile(planPath, JSON.stringify(badPlan, null, 2));

    const cliPath = path.resolve("src/cli.cjs");

    let stderr = "";
    let status = 0;

    try {
      execFileSync(process.execPath, [cliPath, "run-plan", planPath], {
        env: {
          ...process.env,
          URI_URAM: uramRoot,
          URI_WORKSPACE: workspaceDir,
        },
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (error) {
      status = error.status ?? 1;
      stderr = String(error.stderr || "");
    }

    expect(status).toBe(1);
    expect(stderr).toContain("[uri] fatal error");
    expect(stderr).toContain("COMMAND_NOT_FOUND");
  });
});
