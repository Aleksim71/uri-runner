import { describe, it, expect } from "vitest";
import {
  getRunsDir,
  getRunDir,
  getResultPath,
} from "../../src/uram/run-paths.cjs";

describe("run paths", () => {
  it("builds run-scoped paths", () => {
    const historyDir = "/tmp/project-box/history";
    const runId = "run_001";

    expect(getRunsDir(historyDir)).toBe("/tmp/project-box/history/runs");
    expect(getRunDir({ historyDir, runId })).toBe(
      "/tmp/project-box/history/runs/run_001"
    );
    expect(getResultPath({ historyDir, runId })).toBe(
      "/tmp/project-box/history/runs/run_001/RESULT.json"
    );
  });
});
