"use strict";

const fsp = require("fs/promises");
const path = require("path");
const { ERROR_CODES } = require("./error-codes.cjs");

async function ensureDir(dirPath) {
  await fsp.mkdir(dirPath, { recursive: true });
}

async function fileExists(filePath) {
  try {
    await fsp.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function removeIfExists(filePath) {
  try {
    await fsp.rm(filePath, { force: true });
  } catch {
    // ignore cleanup errors
  }
}

function getLocksDir(uramRoot) {
  return path.join(uramRoot, "locks");
}

function makeLockFilePath(uramRoot, project) {
  return path.join(getLocksDir(uramRoot), `${project}.lock`);
}

async function acquireLock(lockFilePath, payload) {
  const body = JSON.stringify(payload, null, 2);

  try {
    const handle = await fsp.open(lockFilePath, "wx");
    try {
      await handle.writeFile(body, "utf8");
    } finally {
      await handle.close();
    }
  } catch (err) {
    if (err && err.code === "EEXIST") {
      const lockErr = new Error(
        `[uri] execution lock already held: ${path.basename(lockFilePath)}`
      );
      lockErr.name = "ExecutionLockError";
      lockErr.code = ERROR_CODES.EXECUTION_LOCKED;
      lockErr.details = { lockFilePath };
      throw lockErr;
    }

    throw err;
  }
}

async function withExecutionLock({ uramRoot, project, runId }, fn) {
  const locksDir = getLocksDir(uramRoot);
  const lockFilePath = makeLockFilePath(uramRoot, project);

  await ensureDir(locksDir);

  await acquireLock(lockFilePath, {
    project,
    runId,
    pid: process.pid,
    createdAt: new Date().toISOString(),
  });

  try {
    return await fn();
  } finally {
    if (await fileExists(lockFilePath)) {
      await removeIfExists(lockFilePath);
    }
  }
}

module.exports = {
  withExecutionLock,
};
