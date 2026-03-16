import { afterEach, describe, expect, it } from "vitest";
import fsp from "fs/promises";
import os from "os";
import path from "path";

import {
  cleanupRuntimeState,
  isInsideScope,
  normalizeScopePaths,
  shouldRemoveDirectory,
  shouldRemoveFile,
} from "../../src/runtime/environment/cleanup-runtime-state.cjs";

async function makeTempDir(prefix = "uri-cleanup-test-") {
  return fsp.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function writeFile(filePath, content = "") {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, content, "utf8");
}

async function exists(targetPath) {
  try {
    await fsp.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

const tempDirs = [];

describe("runtime environment cleanup runtime state", () => {
  afterEach(async () => {
    await Promise.all(
      tempDirs.splice(0).map((dir) =>
        fsp.rm(dir, { recursive: true, force: true })
      )
    );
  });

  it("normalizes scope paths", () => {
    const result = normalizeScopePaths([
      "/tmp/a",
      "/tmp/a",
      "",
      "   ",
      "/tmp/b",
    ]);

    expect(result).toHaveLength(2);
    expect(result.every((item) => path.isAbsolute(item))).toBe(true);
  });

  it("detects paths inside scope", () => {
    const root = path.resolve("/tmp/demo-root");
    const child = path.resolve("/tmp/demo-root/a/b/file.pid");
    const outside = path.resolve("/tmp/other-root/file.pid");

    expect(isInsideScope(child, [root])).toBe(true);
    expect(isInsideScope(root, [root])).toBe(true);
    expect(isInsideScope(outside, [root])).toBe(false);
  });

  it("recognizes removable files and directories", () => {
    expect(shouldRemoveFile("server.pid")).toBe(true);
    expect(shouldRemoveFile("server.lock")).toBe(true);
    expect(shouldRemoveFile("cache.tmp")).toBe(true);
    expect(shouldRemoveFile("notes.txt")).toBe(false);

    expect(shouldRemoveDirectory(".tmp")).toBe(true);
    expect(shouldRemoveDirectory("tmp")).toBe(true);
    expect(shouldRemoveDirectory(".uri-tmp")).toBe(true);
    expect(shouldRemoveDirectory("src")).toBe(false);
  });

  it("removes lock, pid, tmp files and controlled temp dirs inside scope", async () => {
    const root = await makeTempDir();
    tempDirs.push(root);

    const pidFile = path.join(root, "server.pid");
    const lockFile = path.join(root, "worker.lock");
    const tmpFile = path.join(root, "cache.tmp");
    const keepFile = path.join(root, "keep.txt");

    const tmpDir = path.join(root, ".tmp");
    const nestedTmpDir = path.join(root, "nested", ".uri-tmp");
    const nestedKeepFile = path.join(root, "nested", "keep.log");

    await writeFile(pidFile, "123");
    await writeFile(lockFile, "locked");
    await writeFile(tmpFile, "temp");
    await writeFile(keepFile, "keep");

    await writeFile(path.join(tmpDir, "artifact.txt"), "remove me");
    await writeFile(path.join(nestedTmpDir, "child.txt"), "remove me too");
    await writeFile(nestedKeepFile, "keep nested");

    const result = await cleanupRuntimeState({
      scopePaths: [root],
    });

    expect(result.attempted).toBe(true);
    expect(result.failed).toEqual([]);

    expect(await exists(pidFile)).toBe(false);
    expect(await exists(lockFile)).toBe(false);
    expect(await exists(tmpFile)).toBe(false);

    expect(await exists(tmpDir)).toBe(false);
    expect(await exists(nestedTmpDir)).toBe(false);

    expect(await exists(keepFile)).toBe(true);
    expect(await exists(nestedKeepFile)).toBe(true);

    expect(result.removed).toEqual(
      expect.arrayContaining([
        pidFile,
        lockFile,
        tmpFile,
        tmpDir,
        nestedTmpDir,
      ])
    );
  });

  it("does not remove files outside controlled scope", async () => {
    const insideRoot = await makeTempDir("uri-cleanup-inside-");
    const outsideRoot = await makeTempDir("uri-cleanup-outside-");
    tempDirs.push(insideRoot, outsideRoot);

    const insidePid = path.join(insideRoot, "inside.pid");
    const outsidePid = path.join(outsideRoot, "outside.pid");
    const outsideTmpDir = path.join(outsideRoot, ".tmp");

    await writeFile(insidePid, "123");
    await writeFile(outsidePid, "456");
    await writeFile(path.join(outsideTmpDir, "artifact.txt"), "outside");

    const result = await cleanupRuntimeState({
      scopePaths: [insideRoot],
    });

    expect(result.attempted).toBe(true);
    expect(result.failed).toEqual([]);

    expect(await exists(insidePid)).toBe(false);
    expect(await exists(outsidePid)).toBe(true);
    expect(await exists(outsideTmpDir)).toBe(true);
  });

  it("returns attempted false when scope is empty", async () => {
    const result = await cleanupRuntimeState({
      scopePaths: [],
    });

    expect(result).toEqual({
      attempted: false,
      scopePaths: [],
      removed: [],
      failed: [],
    });
  });
});
