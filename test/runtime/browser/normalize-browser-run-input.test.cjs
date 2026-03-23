"use strict";

// path: test/runtime/browser/normalize-browser-run-input.test.cjs

const path = require("node:path");
const { describe, expect, it } = require("vitest");

const {
  normalizeBrowserRunInput,
} = require("../../../src/runtime/browser/normalize-browser-run-input.cjs");

describe("normalizeBrowserRunInput", () => {
  it("applies defaults", () => {
    expect(normalizeBrowserRunInput()).toEqual({
      host: "127.0.0.1",
      port: 9222,
      timeoutMs: 10000,
      artifactsDir: path.resolve("runtime/browser/artifacts"),
    });
  });

  it("normalizes explicit values", () => {
    expect(
      normalizeBrowserRunInput({
        host: "127.0.0.1",
        port: "9333",
        target: "/health",
        artifactsDir: "runtime/custom-browser",
        timeoutMs: "2500",
      })
    ).toEqual({
      host: "127.0.0.1",
      port: 9333,
      target: "/health",
      artifactsDir: path.resolve("runtime/custom-browser"),
      timeoutMs: 2500,
    });
  });

  it("throws on invalid port", () => {
    expect(() => normalizeBrowserRunInput({ port: "0" })).toThrow(
      /positive integer/
    );
  });

  it("throws on invalid timeout", () => {
    expect(() => normalizeBrowserRunInput({ timeoutMs: "-1" })).toThrow(
      /positive integer/
    );
  });
});
