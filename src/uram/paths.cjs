/* path: src/uram/paths.cjs */
"use strict";

const fs = require("fs");
const path = require("path");

function pathExists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function preferExisting(primaryPath, fallbackPath, defaultPath = primaryPath) {
  if (pathExists(primaryPath)) {
    return primaryPath;
  }

  if (pathExists(fallbackPath)) {
    return fallbackPath;
  }

  return defaultPath;
}

function resolveUramRoot({ cliUram, env, homeDir }) {
  if (cliUram && String(cliUram).trim()) {
    return path.resolve(String(cliUram).trim());
  }

  if (env?.URAM_ROOT && String(env.URAM_ROOT).trim()) {
    return path.resolve(String(env.URAM_ROOT).trim());
  }

  const workspaceDefault = path.resolve(homeDir, "workspace", "uram");
  const legacyDefault = path.resolve(homeDir, "uram");

  if (pathExists(workspaceDefault)) {
    return workspaceDefault;
  }

  if (pathExists(legacyDefault)) {
    return legacyDefault;
  }

  return workspaceDefault;
}

function getInboxDir(uramRoot) {
  const modern = path.join(uramRoot, "intake", "Inbox");
  const legacy = path.join(uramRoot, "Inbox");
  return preferExisting(modern, legacy, modern);
}

function getInboxZipPath(uramRoot) {
  return path.join(getInboxDir(uramRoot), "inbox.zip");
}

function getProcessedDir(uramRoot) {
  const modern = path.join(uramRoot, "runtime", "watch", "processed");
  const legacy = path.join(uramRoot, "processed");
  return preferExisting(modern, legacy, modern);
}

function getTmpDir(uramRoot) {
  const modern = path.join(uramRoot, "runtime", "watch", "tmp");
  const legacy = path.join(uramRoot, "tmp");
  return preferExisting(modern, legacy, modern);
}

function getProjectBoxDir(uramRoot, project) {
  return path.join(uramRoot, `${project}Box`);
}

function getHistoryDir(projectBoxDir) {
  return path.join(projectBoxDir, "history");
}

function getLatestOutboxPath(projectBoxDir) {
  return path.join(projectBoxDir, "outbox.latest.zip");
}

module.exports = {
  resolveUramRoot,
  getInboxDir,
  getInboxZipPath,
  getProcessedDir,
  getTmpDir,
  getProjectBoxDir,
  getHistoryDir,
  getLatestOutboxPath,
};
