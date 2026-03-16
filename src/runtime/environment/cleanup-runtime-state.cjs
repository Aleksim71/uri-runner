"use strict";

const fsp = require("fs/promises");
const path = require("path");

const REMOVABLE_FILE_EXTENSIONS = new Set([
  ".pid",
  ".lock",
  ".tmp",
]);

const REMOVABLE_DIR_NAMES = new Set([
  ".tmp",
  "tmp",
  ".uri-tmp",
  ".runtime-tmp",
]);

function normalizeScopePaths(scopePaths) {
  if (!Array.isArray(scopePaths)) {
    return [];
  }

  return [...new Set(
    scopePaths
      .filter((value) => typeof value === "string" && value.trim().length > 0)
      .map((value) => path.resolve(value))
  )];
}

function isInsideScope(targetPath, scopeRoots) {
  const resolvedTarget = path.resolve(targetPath);

  return scopeRoots.some((root) => {
    if (resolvedTarget === root) {
      return true;
    }

    const relative = path.relative(root, resolvedTarget);
    return relative && !relative.startsWith("..") && !path.isAbsolute(relative);
  });
}

function shouldRemoveFile(entryName) {
  const ext = path.extname(entryName);
  return REMOVABLE_FILE_EXTENSIONS.has(ext);
}

function shouldRemoveDirectory(entryName) {
  return REMOVABLE_DIR_NAMES.has(entryName);
}

async function pathExists(targetPath) {
  try {
    await fsp.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function removeFile(targetPath, removed, failed) {
  try {
    await fsp.rm(targetPath, { force: true });
    removed.push(targetPath);
  } catch (error) {
    failed.push({
      path: targetPath,
      reason: error?.message || "failed to remove file",
    });
  }
}

async function removeDir(targetPath, removed, failed) {
  try {
    await fsp.rm(targetPath, { recursive: true, force: true });
    removed.push(targetPath);
  } catch (error) {
    failed.push({
      path: targetPath,
      reason: error?.message || "failed to remove directory",
    });
  }
}

async function scanAndCleanupDir(dirPath, scopeRoots, removed, failed) {
  let entries = [];

  try {
    entries = await fsp.readdir(dirPath, { withFileTypes: true });
  } catch (error) {
    failed.push({
      path: dirPath,
      reason: error?.message || "failed to read directory",
    });
    return;
  }

  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);

    if (!isInsideScope(entryPath, scopeRoots)) {
      continue;
    }

    if (entry.isDirectory()) {
      if (shouldRemoveDirectory(entry.name)) {
        await removeDir(entryPath, removed, failed);
        continue;
      }

      await scanAndCleanupDir(entryPath, scopeRoots, removed, failed);
      continue;
    }

    if (entry.isFile()) {
      if (shouldRemoveFile(entry.name)) {
        await removeFile(entryPath, removed, failed);
      }
    }
  }
}

async function cleanupRuntimeState({
  scopePaths = [],
} = {}) {
  const normalizedScopePaths = normalizeScopePaths(scopePaths);

  if (normalizedScopePaths.length === 0) {
    return {
      attempted: false,
      scopePaths: [],
      removed: [],
      failed: [],
    };
  }

  const removed = [];
  const failed = [];

  for (const scopePath of normalizedScopePaths) {
    if (!(await pathExists(scopePath))) {
      continue;
    }

    let stat;
    try {
      stat = await fsp.stat(scopePath);
    } catch (error) {
      failed.push({
        path: scopePath,
        reason: error?.message || "failed to stat scope path",
      });
      continue;
    }

    if (stat.isDirectory()) {
      await scanAndCleanupDir(scopePath, normalizedScopePaths, removed, failed);
      continue;
    }

    if (stat.isFile() && shouldRemoveFile(path.basename(scopePath))) {
      await removeFile(scopePath, removed, failed);
    }
  }

  return {
    attempted: true,
    scopePaths: normalizedScopePaths,
    removed,
    failed,
  };
}

module.exports = {
  cleanupRuntimeState,
  normalizeScopePaths,
  isInsideScope,
  shouldRemoveFile,
  shouldRemoveDirectory,
};
