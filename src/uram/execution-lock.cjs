"use strict";

const fs = require("fs/promises");
const path = require("path");

async function acquireExecutionLock({ uramRoot, project, runId }) {
  const lockPath = path.join(uramRoot, "locks", `${project}.lock`);

  await fs.mkdir(path.dirname(lockPath), { recursive: true });

  await fs.writeFile(
    lockPath,
    JSON.stringify({
      project,
      runId,
      ts: new Date().toISOString(),
    }),
    { flag: "wx" }
  );

  return { lockPath };
}

async function releaseExecutionLock(lockPath) {
  if (!lockPath) return;

  try {
    await fs.unlink(lockPath);
  } catch {
    // ignore
  }
}

async function withExecutionLock(params, fn) {
  const lock = await acquireExecutionLock(params);

  try {
    return await fn(lock);
  } finally {
    await releaseExecutionLock(lock.lockPath);
  }
}

module.exports = {
  acquireExecutionLock,
  releaseExecutionLock,
  withExecutionLock,
};
