import fs from "fs";
import fsp from "fs/promises";
import os from "os";
import path from "path";
import { describe, it, expect } from "vitest";
import { execFileSync } from "child_process";

function hasRealBrowserEnv() {
  return Boolean(
    process.env.BROWSER_ENDPOINT ||
    (process.env.BROWSER_HOST && process.env.BROWSER_PORT)
  );
}

function buildArgs(artifactsDir) {
  const args = [
    "src/cli.cjs",
    "browser",
    "--json",
    "--artifacts-dir",
    artifactsDir,
  ];

  if (process.env.BROWSER_HOST) {
    args.push("--host", process.env.BROWSER_HOST);
  }

  if (process.env.BROWSER_PORT) {
    args.push("--port", process.env.BROWSER_PORT);
  }

  if (process.env.BROWSER_TARGET) {
    args.push("--target", process.env.BROWSER_TARGET);
  }

  return args;
}

describe("real browser command smoke", () => {
  it("connects to real Chrome DevTools and writes real artifacts", async () => {
    if (!hasRealBrowserEnv()) {
      console.log(
        "[real-skip] set BROWSER_ENDPOINT or BROWSER_HOST+BROWSER_PORT"
      );
      return;
    }

    const artifactsDir = await fsp.mkdtemp(
      path.join(os.tmpdir(), "uri-real-browser-")
    );

    const output = execFileSync(
      process.execPath,
      buildArgs(artifactsDir),
      {
        env: process.env,
        encoding: "utf8",
      }
    );

    const result = JSON.parse(output);

    expect(result.status).toBe("ok");
    expect(result.attachResult.status).toBe("ok");
    expect(result.collectResult.status).toBe("ok");
    expect(result.writeResult.status).toBe("ok");

    const writtenNames = Array.isArray(result.writeResult.written)
      ? result.writeResult.written.map((item) => item.name)
      : [];

    expect(writtenNames.length).toBeGreaterThan(0);

    const dirEntries = fs.readdirSync(artifactsDir);
    expect(dirEntries.length).toBeGreaterThan(0);

    const hasBrowserReport = dirEntries.includes("browser-report.json");
    const hasMetadata = dirEntries.includes("page-metadata.json");

    expect(hasBrowserReport || hasMetadata).toBe(true);
  });
});
