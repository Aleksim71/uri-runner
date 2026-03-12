import { describe, it, expect } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

const { compilePlan } = require("../../src/uram/compile-plan.cjs");
const {
  PLAN_VERSION,
  PLAN_KIND_SCENARIO,
} = require("../../src/uram/plan-schema.cjs");

describe("compile-plan scenario", () => {
  it("compiles a valid scenario runbook into a canonical plan", () => {
    const runbook = {
      version: 1,
      project: "demo",
      steps: [
        {
          id: "step_echo_1",
          command: "system.echo",
          args: {
            message: "hello",
          },
        },
        {
          id: "step_echo_2",
          command: "project.build",
          args: {
            target: "prod",
          },
        },
      ],
    };

    const executableCtx = {
      engine: "scenario",
      commands: {
        roots: ["system", "project"],
      },
      runtime: {
        max_steps: 100,
        strict_commands: true,
      },
    };

    const plan = compilePlan({
      runbook,
      project: "demo",
      executionKind: "scenario",
      executableCtx,
    });

    expect(plan.version).toBe(PLAN_VERSION);
    expect(plan.kind).toBe(PLAN_KIND_SCENARIO);
    expect(plan.engine).toBe("scenario");
    expect(plan.project).toBe("demo");

    expect(plan.runtime.strictCommands).toBe(true);
    expect(plan.runtime.maxSteps).toBe(100);

    expect(plan.steps).toHaveLength(2);

    expect(plan.steps[0]).toMatchObject({
      kind: "command",
      index: 0,
      stepId: "step_echo_1",
      command: "system.echo",
      commandRoot: "system",
      args: {
        message: "hello",
      },
    });

    expect(plan.steps[1]).toMatchObject({
      kind: "command",
      index: 1,
      stepId: "step_echo_2",
      command: "project.build",
      commandRoot: "project",
      args: {
        target: "prod",
      },
    });
  });

  it("throws when command root is not allowed", () => {
    const runbook = {
      version: 1,
      project: "demo",
      steps: [
        {
          id: "step_bad_1",
          command: "admin.deploy",
          args: {},
        },
      ],
    };

    const executableCtx = {
      engine: "scenario",
      commands: {
        roots: ["system", "project"],
      },
      runtime: {
        max_steps: 100,
        strict_commands: true,
      },
    };

    expect(() =>
      compilePlan({
        runbook,
        project: "demo",
        executionKind: "scenario",
        executableCtx,
      })
    ).toThrow();
  });

  it("throws when max_steps is exceeded", () => {
    const runbook = {
      version: 1,
      project: "demo",
      steps: [
        { id: "step_1", command: "system.echo" },
        { id: "step_2", command: "system.echo" },
      ],
    };

    const executableCtx = {
      engine: "scenario",
      commands: {
        roots: ["system"],
      },
      runtime: {
        max_steps: 1,
        strict_commands: true,
      },
    };

    expect(() =>
      compilePlan({
        runbook,
        project: "demo",
        executionKind: "scenario",
        executableCtx,
      })
    ).toThrow();
  });

  it("inherits project from runbook when explicit project is not provided", () => {
    const runbook = {
      version: 1,
      project: "demo-from-runbook",
      steps: [
        {
          id: "step_echo_1",
          command: "system.echo",
        },
      ],
    };

    const executableCtx = {
      engine: "scenario",
      commands: {
        roots: ["system"],
      },
      runtime: {
        max_steps: 100,
        strict_commands: false,
      },
    };

    const plan = compilePlan({
      runbook,
      executionKind: "scenario",
      executableCtx,
    });

    expect(plan.project).toBe("demo-from-runbook");
    expect(plan.runtime.strictCommands).toBe(false);
    expect(plan.runtime.maxSteps).toBe(100);
  });

  it("creates empty args object when args are missing", () => {
    const runbook = {
      version: 1,
      project: "demo",
      steps: [
        {
          id: "step_echo_1",
          command: "system.echo",
        },
      ],
    };

    const executableCtx = {
      engine: "scenario",
      commands: {
        roots: ["system"],
      },
      runtime: {
        max_steps: 100,
        strict_commands: true,
      },
    };

    const plan = compilePlan({
      runbook,
      project: "demo",
      executionKind: "scenario",
      executableCtx,
    });

    expect(plan.steps[0].args).toEqual({});
  });
});
