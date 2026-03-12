import { describe, it, expect } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

const {
  PLAN_VERSION,
  PLAN_KIND_SCENARIO,
  assertPlanShape,
} = require("../../src/uram/plan-schema.cjs");

describe("plan-schema", () => {
  it("accepts a valid plan", () => {
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
          roots: ["system", "project"],
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
            message: "hello",
          },
        },
      ],
    };

    const normalized = assertPlanShape(plan);

    expect(normalized.version).toBe(PLAN_VERSION);
    expect(normalized.kind).toBe(PLAN_KIND_SCENARIO);
    expect(normalized.engine).toBe("scenario");
    expect(normalized.project).toBe("demo");
    expect(normalized.steps.length).toBe(1);
    expect(normalized.steps[0].command).toBe("system.echo");
  });

  it("throws when engine is missing", () => {
    const plan = {
      version: PLAN_VERSION,
      kind: PLAN_KIND_SCENARIO,
      project: "demo",
      runtime: {},
      executableCtxSnapshot: {},
      steps: [
        {
          kind: "command",
          index: 0,
          stepId: "step_echo_1",
          command: "system.echo",
          commandRoot: "system",
        },
      ],
    };

    expect(() => assertPlanShape(plan)).toThrow();
  });

  it("throws when steps is not an array", () => {
    const plan = {
      version: PLAN_VERSION,
      kind: PLAN_KIND_SCENARIO,
      engine: "scenario",
      project: "demo",
      runtime: {},
      executableCtxSnapshot: {},
      steps: null,
    };

    expect(() => assertPlanShape(plan)).toThrow();
  });

  it("throws when step command is missing", () => {
    const plan = {
      version: PLAN_VERSION,
      kind: PLAN_KIND_SCENARIO,
      engine: "scenario",
      project: "demo",
      runtime: {},
      executableCtxSnapshot: {},
      steps: [
        {
          kind: "command",
          index: 0,
          stepId: "bad_step",
          commandRoot: "system",
        },
      ],
    };

    expect(() => assertPlanShape(plan)).toThrow();
  });

  it("normalizes runtime defaults", () => {
    const plan = {
      version: PLAN_VERSION,
      kind: PLAN_KIND_SCENARIO,
      engine: "scenario",
      project: "demo",
      executableCtxSnapshot: {},
      steps: [
        {
          kind: "command",
          index: 0,
          stepId: "step_echo_1",
          command: "system.echo",
          commandRoot: "system",
        },
      ],
    };

    const normalized = assertPlanShape(plan);

    expect(normalized.runtime.strictCommands).toBe(false);
    expect(normalized.runtime.maxSteps).toBe(null);
  });

  it("keeps step order by index", () => {
    const plan = {
      version: PLAN_VERSION,
      kind: PLAN_KIND_SCENARIO,
      engine: "scenario",
      project: "demo",
      runtime: {},
      executableCtxSnapshot: {},
      steps: [
        {
          kind: "command",
          index: 0,
          stepId: "step_a",
          command: "system.echo",
          commandRoot: "system",
        },
        {
          kind: "command",
          index: 1,
          stepId: "step_b",
          command: "system.echo",
          commandRoot: "system",
        },
      ],
    };

    const normalized = assertPlanShape(plan);

    expect(normalized.steps[0].stepId).toBe("step_a");
    expect(normalized.steps[1].stepId).toBe("step_b");
  });
});
