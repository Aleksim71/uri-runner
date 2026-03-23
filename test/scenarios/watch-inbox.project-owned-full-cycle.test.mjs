// path: test/scenarios/watch-inbox.project-owned-full-cycle.test.mjs
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { describe, it, expect } from "vitest";

import {
  createSandbox,
  runUri,
  exists,
  cleanupSandbox,
} from "../helpers/sandbox.cjs";

async function enableProjectOwnedTransport(configPath) {
  const raw = await fsp.readFile(configPath, "utf8");
  const config = JSON.parse(raw);

  config.transportMode = "project-owned";

  await fsp.writeFile(configPath, JSON.stringify(config, null, 2) + "\n", "utf8");
}

describe("watch inbox project-owned full cycle", () => {
  it("does not fail with inboxDir is not defined", async () => {
    const sandbox = await createSandbox();

    try {
      await enableProjectOwnedTransport(sandbox.configPath);

      const fixtureInboxZip = path.join(
        sandbox.projectRoot,
        ".tmp-uram-live",
        "Загрузки",
        "inbox.zip"
      );

      expect(fs.existsSync(fixtureInboxZip)).toBe(true);

      await fsp.copyFile(fixtureInboxZip, path.join(sandbox.downloads, "inbox.zip"));

      let stdout = "";
      let stderr = "";

      try {
        const result = await runUri(["watch", "--once"], sandbox);
        stdout = result.stdout || "";
        stderr = result.stderr || "";
      } catch (error) {
        stdout = error.stdout || "";
        stderr = error.stderr || "";
        const message = [
          "watch --once failed in project-owned mode",
          "",
          "STDOUT:",
          stdout || "<empty>",
          "",
          "STDERR:",
          stderr || "<empty>",
        ].join("\n");
        throw new Error(message);
      }

      expect(stdout).toContain("transport: project-owned");
      expect(stdout).toContain("status: execution started");
      expect(stdout).not.toContain("error: inboxDir is not defined");

      expect(exists(path.join(sandbox.inbox, "inbox.zip"))).toBe(true);
      expect(exists(path.join(sandbox.processed, "inbox.processed.txt"))).toBe(true);
      expect(exists(sandbox.lastRun)).toBe(true);

      const lastRunText = await fsp.readFile(sandbox.lastRun, "utf8");
      expect(lastRunText.trim().length).toBeGreaterThan(0);
    } finally {
      cleanupSandbox(sandbox);
    }
  });
});
