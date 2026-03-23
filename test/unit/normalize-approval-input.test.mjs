// test/unit/normalize-approval-input.test.mjs

import { describe, it, expect } from "vitest";
import { normalizeApprovalInput } from "../../src/runtime/terminal/normalize-approval-input.cjs";

describe("normalizeApprovalInput", () => {
  it("approves on Enter (empty)", () => {
    expect(normalizeApprovalInput("")).toBe("approve");
  });

  it("approves on y/Y", () => {
    expect(normalizeApprovalInput("y")).toBe("approve");
    expect(normalizeApprovalInput("Y")).toBe("approve");
  });

  it("denies on n/N", () => {
    expect(normalizeApprovalInput("n")).toBe("deny");
    expect(normalizeApprovalInput("N")).toBe("deny");
  });

  it("aborts on q/Q", () => {
    expect(normalizeApprovalInput("q")).toBe("abort");
    expect(normalizeApprovalInput("Q")).toBe("abort");
  });

  it("returns invalid for unknown input", () => {
    expect(normalizeApprovalInput("abc")).toBe("invalid");
  });
});
