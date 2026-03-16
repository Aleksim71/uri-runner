import { afterAll, describe, expect, it } from "vitest";
import http from "http";

import {
  checkProcessAliveOnce,
  normalizeHealthcheckPolicy,
  runHealthcheck,
} from "../../src/runtime/environment/run-healthcheck.cjs";

function listen(server, port = 0, host = "127.0.0.1") {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve(server.address());
    });
  });
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

const serversToClose = [];

afterAll(async () => {
  for (const server of serversToClose) {
    try {
      await closeServer(server);
    } catch {
      // ignore close failures in tests
    }
  }
});

describe("runtime environment run healthcheck", () => {
  it("normalizes healthcheck policy", () => {
    expect(normalizeHealthcheckPolicy(undefined)).toEqual({
      type: "http_ok",
      url: "",
      timeoutSec: 30,
      host: "",
      port: null,
      pid: null,
    });

    expect(
      normalizeHealthcheckPolicy({
        type: " port_open ",
        url: " http://127.0.0.1:3000/health ",
        timeoutSec: 5,
        host: " 127.0.0.1 ",
        port: 3000,
        pid: 123,
      })
    ).toEqual({
      type: "port_open",
      url: "http://127.0.0.1:3000/health",
      timeoutSec: 5,
      host: "127.0.0.1",
      port: 3000,
      pid: 123,
    });
  });

  it("passes http healthcheck", async () => {
    const server = http.createServer((req, res) => {
      res.statusCode = 200;
      res.end("ok");
    });

    serversToClose.push(server);
    const address = await listen(server);
    const url = `http://127.0.0.1:${address.port}/health`;

    const result = await runHealthcheck({
      healthcheck: {
        type: "http_ok",
        url,
        timeoutSec: 2,
      },
    });

    expect(result.attempted).toBe(true);
    expect(result.passed).toBe(true);
    expect(result.type).toBe("http_ok");
    expect(result.url).toBe(url);
    expect(result.statusCode).toBe(200);
    expect(typeof result.checkedAt).toBe("string");
  });

  it("fails http healthcheck", async () => {
    const result = await runHealthcheck({
      healthcheck: {
        type: "http_ok",
        url: "http://127.0.0.1:65530/health",
        timeoutSec: 1,
      },
    });

    expect(result.attempted).toBe(true);
    expect(result.passed).toBe(false);
    expect(result.type).toBe("http_ok");
    expect(result.url).toBe("http://127.0.0.1:65530/health");
    expect(typeof result.reason).toBe("string");
  });

  it("passes port_open healthcheck", async () => {
    const server = http.createServer((req, res) => {
      res.statusCode = 200;
      res.end("ok");
    });

    serversToClose.push(server);
    const address = await listen(server);

    const result = await runHealthcheck({
      healthcheck: {
        type: "port_open",
        host: "127.0.0.1",
        port: address.port,
        timeoutSec: 2,
      },
    });

    expect(result.attempted).toBe(true);
    expect(result.passed).toBe(true);
    expect(result.type).toBe("port_open");
    expect(result.host).toBe("127.0.0.1");
    expect(result.port).toBe(address.port);
    expect(typeof result.checkedAt).toBe("string");
  });

  it("fails port_open healthcheck", async () => {
    const result = await runHealthcheck({
      healthcheck: {
        type: "port_open",
        host: "127.0.0.1",
        port: 65531,
        timeoutSec: 1,
      },
    });

    expect(result.attempted).toBe(true);
    expect(result.passed).toBe(false);
    expect(result.type).toBe("port_open");
    expect(result.host).toBe("127.0.0.1");
    expect(result.port).toBe(65531);
    expect(typeof result.reason).toBe("string");
  });

  it("passes process_alive healthcheck", async () => {
    const result = await runHealthcheck({
      healthcheck: {
        type: "process_alive",
        pid: process.pid,
        timeoutSec: 1,
      },
    });

    expect(result.attempted).toBe(true);
    expect(result.passed).toBe(true);
    expect(result.type).toBe("process_alive");
    expect(result.pid).toBe(process.pid);
    expect(typeof result.checkedAt).toBe("string");
  });

  it("fails process_alive healthcheck for missing pid", async () => {
    const impossiblePid = 999999;

    const singleCheck = await checkProcessAliveOnce(impossiblePid);
    expect(singleCheck.ok).toBe(false);

    const result = await runHealthcheck({
      healthcheck: {
        type: "process_alive",
        pid: impossiblePid,
        timeoutSec: 1,
      },
    });

    expect(result.attempted).toBe(true);
    expect(result.passed).toBe(false);
    expect(result.type).toBe("process_alive");
    expect(result.pid).toBe(impossiblePid);
    expect(typeof result.reason).toBe("string");
  });

  it("fails on unsupported healthcheck type", async () => {
    await expect(
      runHealthcheck({
        healthcheck: {
          type: "unknown_type",
          timeoutSec: 1,
        },
      })
    ).rejects.toThrow("Unsupported healthcheck type: unknown_type");
  });
});
