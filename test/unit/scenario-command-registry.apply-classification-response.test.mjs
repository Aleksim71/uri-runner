import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const {
  applyScenarioClassificationResponse,
} = require("../../src/runtime/scenario-command-registry/apply-scenario-classification-response.cjs");

describe("scenario command registry classification response", () => {
  it("adds new named command and browser action entries", () => {
    const registry = {
      registryPath: "/tmp/scenario-command-registry.yaml",
      version: 1,
      defaults: {},
      namedCommands: [],
      browserActions: [],
    };

    const response = {
      classifications: [
        {
          id: "system.echo",
          group: "system",
          profile: "instant",
          match: {
            command: "system.echo",
          },
          args_schema: {
            required: ["message"],
          },
        },
        {
          id: "browser.page.capture",
          group: "browser",
          profile: "browser_navigation",
          match: {
            action: "page.capture",
          },
          args_schema: {
            optional: ["fullPage"],
          },
        },
      ],
    };

    const result = applyScenarioClassificationResponse({ registry, response });

    expect(result.report).toMatchObject({
      ok: true,
      added: 2,
      updated: 0,
      processed: 2,
    });
    expect(result.registry.namedCommands).toEqual([
      expect.objectContaining({
        match: {
          command: "system.echo",
        },
      }),
    ]);
    expect(result.registry.browserActions).toEqual([
      expect.objectContaining({
        match: {
          action: "page.capture",
        },
      }),
    ]);
  });

  it("updates existing browser action entry by match key", () => {
    const registry = {
      registryPath: "/tmp/scenario-command-registry.yaml",
      version: 1,
      defaults: {},
      namedCommands: [],
      browserActions: [
        {
          id: "browser.page.capture.old",
          group: "browser",
          profile: "browser_navigation",
          notes: "old",
          match: {
            action: "page.capture",
          },
          argsSchema: {
            required: [],
            optional: [],
          },
        },
      ],
    };

    const response = {
      classifications: [
        {
          id: "browser.page.capture",
          group: "browser",
          profile: "browser_navigation",
          notes: "updated",
          match: {
            action: "page.capture",
          },
          args_schema: {
            optional: ["fullPage"],
          },
        },
      ],
    };

    const result = applyScenarioClassificationResponse({ registry, response });

    expect(result.report).toMatchObject({
      ok: true,
      added: 0,
      updated: 1,
      processed: 1,
    });
    expect(result.registry.browserActions).toEqual([
      expect.objectContaining({
        id: "browser.page.capture",
        notes: "updated",
        match: {
          action: "page.capture",
        },
      }),
    ]);
  });
});
