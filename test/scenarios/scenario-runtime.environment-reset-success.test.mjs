import { describe, expect, it } from "vitest";
import fsp from "fs/promises";
import os from "os";
import path from "path";

import { compilePlan } from "../../src/uram/compile-plan.cjs";
import { runPlan } from "../../src/uram/run-plan.cjs";

async function makeTempDir(prefix = "uri-env-reset-") {
  return await fsp.mkdtemp(path.join(os.tmpdir(), prefix));
}

describe("scenario runtime environment reset success", () => {
  it("runs environment reset before first step execution", async () => {
    const projectRoot = await makeTempDir();
    const workspaceDir = await makeTempDir();

    try {
      const commandsDir = path.join(
        projectRoot,
        "contexts",
        "project",
        "commands"
      );

      await fsp.mkdir(commandsDir, { recursive: true });

      const commandFile = path.join(commandsDir, "inspect-reset.cjs");
      await fsp.writeFile(
        commandFile,
        `
"use strict";

module.exports = async function ({ context }) {
  return {
    hasEnvironmentReset: Boolean(context.environmentReset),
    resetAttempted: context.environmentReset?.attempted === true,
    hasStopSummary: Boolean(context.environmentReset?.stopSummary),
    hasCleanupSummary: Boolean(context.environmentReset?.cleanupSummary),
    hasStartupSummary: Boolean(context.environmentReset?.startupSummary),
    hasHealthcheckSummary: Boolean(context.environmentReset?.healthcheckSummary),
  };
};
        `.trim() + "\n",
        "utf8"
      );

      const runbook = {
        project: "demo",
        steps: [
          {
            id: "step-1",
            command: "project.inspect-reset",
            args: {},
          },
        ],
      };

      const executableCtx = {
        version: 1,
        engine: "scenario",
        commands: {
          roots: ["project"],
        },
        runtime: {
          max_steps: 100,
          strict_commands: true,
          environment: {
            reset_before_run: true,
            managed_processes: [],
            startup: {
              command: "",
              healthcheck: {
                type: "process_alive",
                pid: process.pid,
                timeoutSec: 1,
              },
            },
          },
        },
      };

      const plan = compilePlan({
        runbook,
        project: "demo",
        executionKind: "scenario",
        executableCtx,
      });

      const result = await runPlan({
        plan,
        projectRoot,
        runId: "run_test",
        workspaceDir,
      });

      expect(result.exitCode).toBe(0);
      expect(result.meta.loadedCommands).toEqual(["project.inspect-reset"]);
      expect(result.meta.planRun.executionStatus).toBe("success");
      expect(result.meta.planRun.stepsCompleted).toBe(1);

      expect(result.outboxPayload.result.results).toEqual([
        {
          stepId: "step-1",
          command: "project.inspect-reset",
          ok: true,
          value: {
            hasEnvironmentReset: true,
            resetAttempted: true,
            hasStopSummary: true,
            hasCleanupSummary: true,
            hasStartupSummary: true,
            hasHealthcheckSummary: true,
          },
        },
      ]);
    } finally {
      await fsp.rm(projectRoot, { recursive: true, force: true });
      await fsp.rm(workspaceDir, { recursive: true, force: true });
    }
  });
});
