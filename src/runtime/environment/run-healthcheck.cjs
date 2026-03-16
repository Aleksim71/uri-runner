"use strict";

const http = require("http");
const https = require("https");
const net = require("net");

const DEFAULT_TIMEOUT_SEC = 30;
const SUPPORTED_HEALTHCHECK_TYPES = new Set([
  "http_ok",
  "port_open",
  "process_alive",
]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeHealthcheckPolicy(healthcheck) {
  const source =
    healthcheck && typeof healthcheck === "object" && !Array.isArray(healthcheck)
      ? healthcheck
      : {};

  return {
    type:
      typeof source.type === "string" && source.type.trim()
        ? source.type.trim()
        : "http_ok",
    url: typeof source.url === "string" ? source.url.trim() : "",
    timeoutSec:
      Number.isFinite(source.timeoutSec) && source.timeoutSec > 0
        ? source.timeoutSec
        : DEFAULT_TIMEOUT_SEC,
    host: typeof source.host === "string" ? source.host.trim() : "",
    port:
      Number.isInteger(source.port) && source.port > 0
        ? source.port
        : null,
    pid:
      Number.isInteger(source.pid) && source.pid > 0
        ? source.pid
        : null,
  };
}

function ensureSupportedType(type) {
  if (!SUPPORTED_HEALTHCHECK_TYPES.has(type)) {
    throw new Error(`Unsupported healthcheck type: ${type}`);
  }
}

async function checkHttpOkOnce(url, timeoutMs) {
  return await new Promise((resolve) => {
    let settled = false;

    function finish(result) {
      if (settled) {
        return;
      }
      settled = true;
      resolve(result);
    }

    let parsed;
    try {
      parsed = new URL(url);
    } catch (error) {
      finish({
        ok: false,
        reason: `invalid url: ${error.message}`,
      });
      return;
    }

    const client = parsed.protocol === "https:" ? https : http;

    const req = client.get(
      parsed,
      {
        timeout: timeoutMs,
      },
      (res) => {
        const statusCode = Number(res.statusCode || 0);
        res.resume();

        if (statusCode >= 200 && statusCode < 300) {
          finish({
            ok: true,
            statusCode,
          });
          return;
        }

        finish({
          ok: false,
          statusCode,
          reason: `unexpected status code: ${statusCode}`,
        });
      }
    );

    req.on("timeout", () => {
      req.destroy(new Error("request timeout"));
    });

    req.on("error", (error) => {
      finish({
        ok: false,
        reason: error.message || "http request failed",
      });
    });
  });
}

async function checkPortOpenOnce(host, port, timeoutMs) {
  return await new Promise((resolve) => {
    let settled = false;

    function finish(result) {
      if (settled) {
        return;
      }
      settled = true;
      resolve(result);
    }

    const socket = new net.Socket();

    socket.setTimeout(timeoutMs);

    socket.once("connect", () => {
      socket.destroy();
      finish({ ok: true });
    });

    socket.once("timeout", () => {
      socket.destroy();
      finish({
        ok: false,
        reason: "port check timeout",
      });
    });

    socket.once("error", (error) => {
      socket.destroy();
      finish({
        ok: false,
        reason: error.message || "port check failed",
      });
    });

    socket.connect(port, host);
  });
}

async function checkProcessAliveOnce(pid) {
  try {
    process.kill(pid, 0);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reason: error.message || "process is not alive",
    };
  }
}

async function runHttpOk(policy) {
  if (!policy.url) {
    throw new Error("http_ok healthcheck requires url");
  }

  const timeoutMs = policy.timeoutSec * 1000;
  const deadline = Date.now() + timeoutMs;
  let lastFailure = "http healthcheck failed";

  while (Date.now() <= deadline) {
    const result = await checkHttpOkOnce(policy.url, Math.min(1000, timeoutMs));

    if (result.ok) {
      return {
        attempted: true,
        passed: true,
        type: "http_ok",
        url: policy.url,
        checkedAt: nowIso(),
        timeoutSec: policy.timeoutSec,
        statusCode: result.statusCode || 200,
      };
    }

    lastFailure = result.reason || lastFailure;
    await sleep(200);
  }

  return {
    attempted: true,
    passed: false,
    type: "http_ok",
    url: policy.url,
    checkedAt: nowIso(),
    timeoutSec: policy.timeoutSec,
    reason: lastFailure,
  };
}

async function runPortOpen(policy) {
  const host = policy.host || "127.0.0.1";

  if (!policy.port) {
    throw new Error("port_open healthcheck requires port");
  }

  const timeoutMs = policy.timeoutSec * 1000;
  const deadline = Date.now() + timeoutMs;
  let lastFailure = "port healthcheck failed";

  while (Date.now() <= deadline) {
    const result = await checkPortOpenOnce(host, policy.port, Math.min(1000, timeoutMs));

    if (result.ok) {
      return {
        attempted: true,
        passed: true,
        type: "port_open",
        host,
        port: policy.port,
        checkedAt: nowIso(),
        timeoutSec: policy.timeoutSec,
      };
    }

    lastFailure = result.reason || lastFailure;
    await sleep(200);
  }

  return {
    attempted: true,
    passed: false,
    type: "port_open",
    host,
    port: policy.port,
    checkedAt: nowIso(),
    timeoutSec: policy.timeoutSec,
    reason: lastFailure,
  };
}

async function runProcessAlive(policy) {
  if (!policy.pid) {
    throw new Error("process_alive healthcheck requires pid");
  }

  const timeoutMs = policy.timeoutSec * 1000;
  const deadline = Date.now() + timeoutMs;
  let lastFailure = "process healthcheck failed";

  while (Date.now() <= deadline) {
    const result = await checkProcessAliveOnce(policy.pid);

    if (result.ok) {
      return {
        attempted: true,
        passed: true,
        type: "process_alive",
        pid: policy.pid,
        checkedAt: nowIso(),
        timeoutSec: policy.timeoutSec,
      };
    }

    lastFailure = result.reason || lastFailure;
    await sleep(200);
  }

  return {
    attempted: true,
    passed: false,
    type: "process_alive",
    pid: policy.pid,
    checkedAt: nowIso(),
    timeoutSec: policy.timeoutSec,
    reason: lastFailure,
  };
}

async function runHealthcheck({
  healthcheck = {},
} = {}) {
  const policy = normalizeHealthcheckPolicy(healthcheck);

  ensureSupportedType(policy.type);

  if (policy.type === "http_ok") {
    return await runHttpOk(policy);
  }

  if (policy.type === "port_open") {
    return await runPortOpen(policy);
  }

  if (policy.type === "process_alive") {
    return await runProcessAlive(policy);
  }

  throw new Error(`Unsupported healthcheck type: ${policy.type}`);
}

module.exports = {
  normalizeHealthcheckPolicy,
  runHealthcheck,
  checkHttpOkOnce,
  checkPortOpenOnce,
  checkProcessAliveOnce,
};
