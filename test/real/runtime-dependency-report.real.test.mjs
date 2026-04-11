// test/real/runtime-dependency-report.real.test.mjs

import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";

const ROOT = process.cwd();
const FIXTURE_ZIP = path.join(ROOT, "test/real/fixtures/02_runtime_dependency.zip");
const ROOT_PROJECTS_CONFIG = path.join(ROOT, "config", "projects.yaml");

function ensureExists(targetPath, label) {
  if (!fs.existsSync(targetPath)) {
    throw new Error(`${label} not found: ${targetPath}`);
  }
}

function readJson(targetPath, label) {
  ensureExists(targetPath, label);
  return JSON.parse(fs.readFileSync(targetPath, "utf8"));
}

describe("real: runtime dependency scenario report", () => {
  let sandboxRoot;
  let downloadsDir;
  let intakeDir;
  let processedDir;
  let sourceProcessedDir;
  let configPath;
  let sandboxProjectsConfigPath;

  beforeEach(() => {
    sandboxRoot = fs.mkdtempSync(path.join(os.tmpdir(), "uri-real-runtime-dependency-"));
    downloadsDir = path.join(sandboxRoot, "downloads");
    intakeDir = path.join(sandboxRoot, "intake", "Inbox");
    processedDir = path.join(sandboxRoot, "runtime", "watch", "processed");
    sourceProcessedDir = path.join(sandboxRoot, "intake", "source-processed");
    configPath = path.join(sandboxRoot, "config", "watch.json");
    sandboxProjectsConfigPath = path.join(sandboxRoot, "config", "projects.yaml");

    fs.mkdirSync(downloadsDir, { recursive: true });
    fs.mkdirSync(intakeDir, { recursive: true });
    fs.mkdirSync(processedDir, { recursive: true });
    fs.mkdirSync(sourceProcessedDir, { recursive: true });
    fs.mkdirSync(path.dirname(configPath), { recursive: true });

    ensureExists(FIXTURE_ZIP, "fixture zip");
    fs.copyFileSync(FIXTURE_ZIP, path.join(downloadsDir, "inbox.zip"));

    ensureExists(ROOT_PROJECTS_CONFIG, "root projects config");
    fs.copyFileSync(ROOT_PROJECTS_CONFIG, sandboxProjectsConfigPath);

    fs.writeFileSync(
      configPath,
      JSON.stringify(
        {
          transportMode: "project-owned",
          downloads: downloadsDir,
          intakeDir,
          processedDir,
          sourceProcessedDir,
        },
        null,
        2
      ) + "\n",
      "utf8"
    );
  });

  it("fails until outbox proves sourceScenario, executedScenario, steps, and checks", () => {
    execFileSync("npx", ["uri", "watch", "--once", "--config", configPath], {
      cwd: ROOT,
      stdio: "inherit",
      env: {
        ...process.env,
        URI_WATCH_CONFIG: configPath,
      },
    });

    const outboxPath = path.join(processedDir, "outbox.json");
    const outbox = readJson(outboxPath, "processed outbox");

    expect(outbox).toBeDefined();
    expect(typeof outbox).toBe("object");

    // 1. sourceScenario: what came in from the runbook
    expect(outbox.sourceScenario).toBeDefined();
    expect(typeof outbox.sourceScenario).toBe("object");
    expect(outbox.sourceScenario.id).toBe("02_runtime_dependency");

    // 2. executedScenario: what URI actually compiled/executed
    expect(outbox.executedScenario).toBeDefined();
    expect(typeof outbox.executedScenario).toBe("object");
    expect(outbox.executedScenario.engine).toBe("scenario");

    // 3. steps: executed steps must be present
    expect(Array.isArray(outbox.steps)).toBe(true);

    const stepMap = new Map(outbox.steps.map((step) => [step.stepId, step]));

    for (const stepId of ["step_echo_1", "step_echo_2", "step_echo_3"]) {
      expect(stepMap.has(stepId)).toBe(true);

      const step = stepMap.get(stepId);
      expect(step.status).toBe("success");
      expect(step.result).toBe("hello from dependency chain");
    }

    // 4. checks: scenario verification must be present
    expect(Array.isArray(outbox.checks)).toBe(true);

    const dependencyCheck = outbox.checks.find(
      (check) =>
        check &&
        (check.target === "step_echo_3.result" ||
          check.left === "step_echo_3.result" ||
          check.path === "step_echo_3.result")
    );

    expect(dependencyCheck).toBeDefined();
    expect(dependencyCheck.passed).toBe(true);
    expect(
      dependencyCheck.actual ?? dependencyCheck.value ?? dependencyCheck.right
    ).toBe("hello from dependency chain");
    expect(
      dependencyCheck.expected ?? dependencyCheck.equals
    ).toBe("hello from dependency chain");
  });
});
