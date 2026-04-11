/* path: test/real/watch-pipeline.truth-stress.real.test.mjs */
import { describe, it, expect } from "vitest";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import crypto from "crypto";

const execFileAsync = promisify(execFile);

const PROJECT_ROOT = process.env.URI_PROJECT_ROOT || process.cwd();
const DOWNLOADS_DIR =
  process.env.URI_DOWNLOADS_DIR || path.join(os.homedir(), "Загрузки");

const DEFAULT_PROJECT_OUTBOX_ZIP = process.env.URI_PROJECT_OUTBOX_ZIP ||
  path.join(os.homedir(), "workspace", "projects", "tempasi", "Outbox", "outbox.zip");

const DEFAULT_TRANSPORT_OUTBOX_ZIP = process.env.URI_TRANSPORT_OUTBOX_ZIP ||
  path.join(PROJECT_ROOT, "runtime", "watch", "processed", "outbox.zip");

const TMP_ROOT = path.join(PROJECT_ROOT, ".tmp-truth-stress");
const ITERATIONS = Number.parseInt(process.env.URI_STRESS_ITERATIONS || "3", 10);

function yamlEscape(value) {
  return String(value).replace(/"/g, '\"');
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function removeIfExists(targetPath) {
  try {
    await fs.rm(targetPath, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function writeFile(filePath, text) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, text, "utf8");
}

async function createInboxZip({ downloadsDir, iteration, marker }) {
  const buildDir = path.join(TMP_ROOT, `build-${iteration}-${marker}`);
  await removeIfExists(buildDir);
  await ensureDir(buildDir);

  const runbookText = [
    "version: 1",
    "receiver: uri",
    "project: tempasi",
    `goal: Truth stress test iteration ${iteration}`,
    "",
    "steps:",
    "  - id: step_echo_1",
    "    command: system.echo",
    "    args:",
    `      message: "${yamlEscape(`truth-stress-${marker}`)}"`,
    "",
    "provide: []",
    "modify: []",
    "goal_checks: []",
    "",
  ].join("\n");

  const runbookPath = path.join(buildDir, "RUNBOOK.yaml");
  await writeFile(runbookPath, runbookText);

  const zipPath = path.join(downloadsDir, "inbox.zip");
  await removeIfExists(zipPath);

  await execFileAsync("zip", ["-q", "-j", zipPath, runbookPath], {
    cwd: buildDir,
  });

  return {
    zipPath,
    expectedMessage: `truth-stress-${marker}`,
  };
}

async function readJsonFromZip(zipPath, archivePath) {
  const { stdout } = await execFileAsync("unzip", ["-p", zipPath, archivePath], {
    cwd: PROJECT_ROOT,
    maxBuffer: 10 * 1024 * 1024,
  });

  return JSON.parse(stdout);
}

async function resolveOutboxZip() {
  const candidates = [
    DEFAULT_PROJECT_OUTBOX_ZIP,
    DEFAULT_TRANSPORT_OUTBOX_ZIP,
  ];

  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }

  throw new Error(`outbox.zip not found in any candidate path: ${candidates.join(", ")}`);
}

async function runWatcherOnce() {
  const result = await execFileAsync("uri", ["watch", "--once"], {
    cwd: PROJECT_ROOT,
    maxBuffer: 10 * 1024 * 1024,
    env: {
      ...process.env,
    },
  });

  return {
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
}

function assertOutboxPayload(payload, expectedMessage) {
  expect(payload).toBeTruthy();
  expect(payload.status).toBe("success");
  expect(payload.attempts).toBeGreaterThanOrEqual(1);

  if ("ok" in payload) {
    expect(payload.ok).toBe(true);
  }

  if ("project" in payload) {
    expect(payload.project).toBe("tempasi");
  }

  if ("engine" in payload) {
    expect(payload.engine).toBe("scenario");
  }

  if ("exitCode" in payload) {
    expect(payload.exitCode).toBe(0);
  }

  if (payload?.result?.results && Array.isArray(payload.result.results)) {
    expect(payload.result.results.length).toBeGreaterThanOrEqual(1);

    const asText = JSON.stringify(payload.result.results[0]);
    expect(asText).toContain(expectedMessage);
  }
}

describe("watch pipeline truth stress", () => {
  it(
    `creates inbox.zip in downloads, runs pipeline, and validates outbox (${ITERATIONS} iterations)`,
    async () => {
      await ensureDir(DOWNLOADS_DIR);
      await removeIfExists(TMP_ROOT);
      await ensureDir(TMP_ROOT);

      for (let iteration = 1; iteration <= ITERATIONS; iteration += 1) {
        const marker = crypto.randomBytes(4).toString("hex");

        const beforeProjectOutboxMtime = await (async () => {
          try {
            const stat = await fs.stat(DEFAULT_PROJECT_OUTBOX_ZIP);
            return stat.mtimeMs;
          } catch {
            return 0;
          }
        })();

        const beforeTransportOutboxMtime = await (async () => {
          try {
            const stat = await fs.stat(DEFAULT_TRANSPORT_OUTBOX_ZIP);
            return stat.mtimeMs;
          } catch {
            return 0;
          }
        })();

        const { expectedMessage } = await createInboxZip({
          downloadsDir: DOWNLOADS_DIR,
          iteration,
          marker,
        });

        const run = await runWatcherOnce();

        expect(run.stdout).toContain("status: started");
        expect(run.stdout).toContain("status: inbox.zip detected");
        expect(run.stdout).toContain("status: accepted");
        expect(run.stdout).toContain("status: execution started");
        expect(run.stdout).toMatch(/status: execution completed|status: completed/);

        const outboxZipPath = await resolveOutboxZip();
        expect(await pathExists(outboxZipPath)).toBe(true);

        const outboxStat = await fs.stat(outboxZipPath);
        expect(outboxStat.size).toBeGreaterThan(0);

        const afterProjectOutboxMtime = await (async () => {
          try {
            const stat = await fs.stat(DEFAULT_PROJECT_OUTBOX_ZIP);
            return stat.mtimeMs;
          } catch {
            return 0;
          }
        })();

        const afterTransportOutboxMtime = await (async () => {
          try {
            const stat = await fs.stat(DEFAULT_TRANSPORT_OUTBOX_ZIP);
            return stat.mtimeMs;
          } catch {
            return 0;
          }
        })();

        expect(
          afterProjectOutboxMtime > beforeProjectOutboxMtime ||
          afterTransportOutboxMtime > beforeTransportOutboxMtime
        ).toBe(true);

        let payload = null;
        try {
          payload = await readJsonFromZip(outboxZipPath, "outbox.json");
        } catch {
          payload = await readJsonFromZip(outboxZipPath, "REPORT/outbox.json");
        }

        assertOutboxPayload(payload, expectedMessage);
      }
    },
    120000
  );
});
