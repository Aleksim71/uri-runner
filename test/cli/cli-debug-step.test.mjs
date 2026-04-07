import { describe, it, expect } from "vitest";
import path from "path";
import { execFileSync } from "child_process";

function runCli(args) {
  const cliPath = path.resolve("src/cli.cjs");
  const output = execFileSync(process.execPath, [cliPath, ...args], {
    encoding: "utf8",
  });

  return JSON.parse(output);
}

describe("cli debug step", () => {
  it("executes browser.session.start", () => {
    const result = runCli([
      "debug",
      "step",
      "browser.session.start",
      "--input",
      JSON.stringify({ url: "https://example.com/start" }),
    ]);

    expect(result.ok).toBe(true);
    expect(result.stepType).toBe("browser.session.start");
    expect(result.result.ok).toBe(true);
    expect(result.result.sessionId).toBe("debug-session");
  });

  it("executes browser.page.open", () => {
    const result = runCli([
      "debug",
      "step",
      "browser.page.open",
      "--input",
      JSON.stringify({ url: "https://example.com/open", pageTitle: "Open Debug" }),
    ]);

    expect(result.ok).toBe(true);
    expect(result.stepType).toBe("browser.page.open");
    expect(result.result.ok).toBe(true);
    expect(result.result.url).toBe("https://example.com/open");
    expect(result.result.title).toBe("Open Debug");
  });

  it("executes browser.page.wait", () => {
    const result = runCli([
      "debug",
      "step",
      "browser.page.wait",
      "--input",
      JSON.stringify({
        url: "https://example.com/wait",
        ready: true,
        waitUntil: "networkidle",
        timeoutMs: 25,
      }),
    ]);

    expect(result.ok).toBe(true);
    expect(result.stepType).toBe("browser.page.wait");
    expect(result.result.ok).toBe(true);
    expect(result.result.stepType).toBe("browser.page.wait");
    expect(result.result.sessionId).toBe("debug-session");
  });

  it("executes browser.session.stop", () => {
    const result = runCli([
      "debug",
      "step",
      "browser.session.stop",
      "--input",
      JSON.stringify({ pageUrl: "https://example.com/stop" }),
    ]);

    expect(result.ok).toBe(true);
    expect(result.stepType).toBe("browser.session.stop");
    expect(result.result.ok).toBe(true);
    expect(result.result.sessionId).toBe("debug-session");
    expect(result.sessions).toEqual({});
  });
});
