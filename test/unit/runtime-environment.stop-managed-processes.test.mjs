import { describe, expect, it, vi } from "vitest";

import {
  parsePsOutput,
  stopManagedProcesses,
} from "../../src/runtime/environment/stop-managed-processes.cjs";

describe("runtime environment stop managed processes", () => {
  it("parses ps output", () => {
    const result = parsePsOutput(`
123 node server.js
456 npm run dev
`);

    expect(result).toEqual([
      { pid: 123, command: "node server.js" },
      { pid: 456, command: "npm run dev" },
    ]);
  });

  it("stops matching managed process", async () => {
    const listProcessesFn = vi.fn().mockResolvedValue([
      { pid: 111, command: "node /app/server.js" },
      { pid: 222, command: "bash unrelated.sh" },
    ]);

    const stopOneProcessFn = vi.fn().mockResolvedValue({
      ok: true,
      pid: 111,
      command: "node /app/server.js",
      mode: "graceful",
    });

    const result = await stopManagedProcesses({
      managedProcesses: [{ command_contains: "server.js" }],
      listProcessesFn,
      stopOneProcessFn,
    });

    expect(result).toEqual({
      attempted: true,
      stopped: [
        {
          pid: 111,
          command: "node /app/server.js",
          mode: "graceful",
        },
      ],
      failed: [],
    });

    expect(stopOneProcessFn).toHaveBeenCalledTimes(1);
    expect(stopOneProcessFn).toHaveBeenCalledWith({
      pid: 111,
      command: "node /app/server.js",
    });
  });

  it("ignores unrelated process", async () => {
    const listProcessesFn = vi.fn().mockResolvedValue([
      { pid: 222, command: "bash unrelated.sh" },
    ]);

    const stopOneProcessFn = vi.fn();

    const result = await stopManagedProcesses({
      managedProcesses: [{ command_contains: "server.js" }],
      listProcessesFn,
      stopOneProcessFn,
    });

    expect(result).toEqual({
      attempted: true,
      stopped: [],
      failed: [],
    });

    expect(stopOneProcessFn).not.toHaveBeenCalled();
  });

  it("force kill fallback works when graceful stop fails", async () => {
    const listProcessesFn = vi.fn().mockResolvedValue([
      { pid: 333, command: "node dev-server.js" },
    ]);

    const stopOneProcessFn = vi.fn().mockResolvedValue({
      ok: true,
      pid: 333,
      command: "node dev-server.js",
      mode: "force",
    });

    const result = await stopManagedProcesses({
      managedProcesses: [{ command_contains: "dev-server.js" }],
      listProcessesFn,
      stopOneProcessFn,
    });

    expect(result).toEqual({
      attempted: true,
      stopped: [
        {
          pid: 333,
          command: "node dev-server.js",
          mode: "force",
        },
      ],
      failed: [],
    });
  });
});
