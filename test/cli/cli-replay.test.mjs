import { describe, it, expect } from "vitest";
import fs from "fs";
import fsp from "fs/promises";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";

describe("cli replay", () => {
  it("replays a stored plan artifact", async () => {
    const root = await fsp.mkdtemp(
      path.join(os.tmpdir(), "uri-v3-replay-")
    );

    const uramRoot = path.join(root, "uram");

    // тут можно сначала сделать обычный run,
    // получить runId
    // потом вызвать replay

    // структура теста аналогична smoke
    // но финальный шаг:

    const output = execFileSync(
      "node",
      [
        "src/cli/cli.cjs",
        "replay",
        runId,
        "demo",
      ],
      {
        cwd: process.cwd(),
      }
    ).toString();

    const payload = JSON.parse(output);

    expect(payload.ok).toBe(true);
  });
});
