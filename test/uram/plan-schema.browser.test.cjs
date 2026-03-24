"use strict";

// path: test/uram/plan-schema.browser.test.cjs

const { describe, expect, it } = require("vitest");
const { assertPlanShape } = require("../../src/uram/plan-schema.cjs");

describe("materialized browser diagnostics step schema", () => {
  it("accepts browser diagnostics step", () => {
    const plan = assertPlanShape({
      version: 1,
      kind: "materialized-plan",
      receiver: "uri",
      project: "uri-runner-next",
      goal: "run browser diagnostics",
      steps: [
        {
          type: "browser",
          action: "diagnostics.run",
          payload: {
            host: "127.0.0.1",
            port: 9222,
            target: "/",
            timeoutMs: 1000,
            artifactsDir: "runtime/browser/artifacts",
          },
        },
      ],
    });

    expect(plan.steps[0]).toMatchObject({
      type: "browser",
      action: "diagnostics.run",
    });
  });

  it("rejects invalid browser port", () => {
    expect(() =>
      assertPlanShape({
        version: 1,
        kind: "materialized-plan",
        receiver: "uri",
        project: "uri-runner-next",
        goal: "run browser diagnostics",
        steps: [
          {
            type: "browser",
            action: "diagnostics.run",
            payload: {
              port: 0,
            },
          },
        ],
      })
    ).toThrow(/payload\.port/);
  });
});
