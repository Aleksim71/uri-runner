import { describe, it, expect } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { runPlan } = require("../../src/uram/run-plan.cjs");

describe("scenario runtime invalid plan contract", () => {
  it("fails when plan.steps is missing", async () => {
    await expect(
      runPlan({
        plan: {
          version: 1,
        },
        projectRoot: "/tmp",
        runId: "test",
        workspaceDir: "/tmp",
      })
    ).rejects.toMatchObject({
      code: "PLAN_SCHEMA_INVALID",
    });
  });

  it("fails when step is malformed", async () => {
    await expect(
      runPlan({
        plan: {
          version: 1,
          steps: [{}],
        },
        projectRoot: "/tmp",
        runId: "test",
        workspaceDir: "/tmp",
      })
    ).rejects.toMatchObject({
      code: "PLAN_SCHEMA_INVALID",
    });
  });

  it("fails when commandRoot is missing", async () => {
    await expect(
      runPlan({
        plan: {
          version: 1,
          steps: [
            {
              kind: "command",
              command: "system.echo",
            },
          ],
        },
        projectRoot: "/tmp",
        runId: "test",
        workspaceDir: "/tmp",
      })
    ).rejects.toMatchObject({
      code: "PLAN_SCHEMA_INVALID",
    });
  });
});
