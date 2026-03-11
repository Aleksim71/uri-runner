"use strict";

const fs = require("fs/promises");
const path = require("path");

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

function getLockPath(uramRoot, project) {
  return path.join(uramRoot, "locks", `${project}.lock`);
}

async function acquireExecutionLock({ uramRoot, project, runId }) {
  if (!uramRoot || typeof uramRoot !== "string") {
    throw new Error("[uri] acquireExecutionLock: uramRoot is required");
  }

  if (!project || typeof project !== "string") {
    throw new Error("[uri] acquireExecutionLock: project is required");
  }

  const locksDir = path.join(uramRoot, "locks");
  await ensureDir(locksDir);

  const lockPath = getLockPath(uramRoot, project);

  let handle;
  try {
    handle = await fs.open(lockPath, "wx");
  } catch (error) {
    if (error && error.code === "EEXIST") {
      throw new Error(`[uri] run: execution locked for project "${project}"`);
    }
    throw error;
  }

  const payload = {
    project,
    run_id: runId,
    pid: process.pid,
    started_at: new Date().toISOString(),
  };

  await handle.writeFile(`${JSON.stringify(payload, null, 2)}\n`, "utf-8");
  await handle.close();

  return { lockPath };
}

async function releaseExecutionLock(lockPath) {
  if (!lockPath) return;

  try {
    await fs.unlink(lockPath);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return;
    }
    throw error;
  }
}

module.exports = {
  acquireExecutionLock,
  releaseExecutionLock,
  getLockPath,
};
