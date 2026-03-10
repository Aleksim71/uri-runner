const fs = require("fs-extra");
const path = require("path");
const http = require("node:http");
const { spawn } = require("node:child_process");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve({ statusCode: res.statusCode || 0, headers: res.headers || {} });
    });
    req.on("error", reject);
  });
}

async function startServer({ cwd, reportDir, cmd, args = [], env = undefined }) {
  await fs.ensureDir(reportDir);

  const outPath = path.join(reportDir, "server.out.log");
  const errPath = path.join(reportDir, "server.err.log");

  const outStream = fs.createWriteStream(outPath, { flags: "w" });
  const errStream = fs.createWriteStream(errPath, { flags: "w" });

  const child = spawn(cmd, args, {
    cwd,
    env: env ? { ...process.env, ...env } : process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.pipe(outStream);
  child.stderr.pipe(errStream);

  return { child, outPath, errPath };
}

async function stopServer(child, graceMs = 1500) {
  if (!child || child.killed) return;

  child.kill("SIGTERM");

  const exited = await Promise.race([
    new Promise((r) => child.once("exit", () => r(true))),
    sleep(graceMs).then(() => false),
  ]);

  if (!exited) {
    child.kill("SIGKILL");
    await new Promise((r) => child.once("exit", () => r(true)));
  }
}

async function waitHttpReadiness({ baseUrl, path: p = "/health", timeoutMs = 8000, intervalMs = 200 }) {
  const started = Date.now();
  const url = new URL(p, baseUrl).toString();

  let lastError = null;
  let attempts = 0;

  while (Date.now() - started < timeoutMs) {
    attempts += 1;
    try {
      const res = await httpGet(url);
      if (res.statusCode >= 200 && res.statusCode < 400) {
        return { ok: true, url, statusCode: res.statusCode, attempts, ms: Date.now() - started };
      }
      lastError = new Error(`status ${res.statusCode}`);
    } catch (e) {
      lastError = e;
    }
    await sleep(intervalMs);
  }

  return {
    ok: false,
    url,
    attempts,
    ms: Date.now() - started,
    error: lastError ? String(lastError.message || lastError) : "timeout",
  };
}

module.exports = { startServer, stopServer, waitHttpReadiness };
