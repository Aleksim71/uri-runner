"use strict";

const path = require("path");

function resolveUramRoot({ cliUram, env, homeDir }) {
  // Priority C:
  // 1) --uram
  // 2) URAM_ROOT env
  // 3) ~/uram
  if (cliUram && String(cliUram).trim()) return path.resolve(String(cliUram).trim());
  if (env?.URAM_ROOT && String(env.URAM_ROOT).trim()) return path.resolve(String(env.URAM_ROOT).trim());
  return path.resolve(homeDir, "uram");
}

function getInboxDir(uramRoot) {
  return path.join(uramRoot, "Inbox");
}

function getInboxZipPath(uramRoot) {
  return path.join(getInboxDir(uramRoot), "inbox.zip");
}

function getProcessedDir(uramRoot) {
  return path.join(getInboxDir(uramRoot), "processed");
}

function getTmpDir(uramRoot) {
  return path.join(uramRoot, "tmp");
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
