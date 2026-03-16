import { describe, it, expect } from "vitest";
import fsp from "fs/promises";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";

describe("cli replay", () => {
  it("replays a stored plan artifact", async () => {
    const root = await fsp.mkdtemp(
      path.join(os.tmpdir(), "uri-v3-replay-")
    );

    const tracePath = path.join(root, "trace.json");

    await fsp.writeFile(
      tracePath,
      JSON.stringify(
        {
          schema: 1,
          runId: "test-run-id",
          createdAt: "2026-01-01T00:00:00.000Z",
          finishedAt: "2026-01-01T00:00:01.000Z",
          goal: "Replay trace",
          finalStatus: "success",
          attempts: 1,
          steps: [],
        },
        null,
        2
      ),
      "utf8"
    );

    const output = execFileSync(
      process.execPath,
      [
        "src/cli.cjs",
        "replay",
        tracePath,
      ],
      {
        cwd: process.cwd(),
      }
    ).toString();

    expect(output).toContain("URI REPLAY");
  });
});
