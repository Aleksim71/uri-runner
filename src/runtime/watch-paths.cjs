/* path: src/runtime/watch-paths.cjs */
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

function pickFirst(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  return undefined;
}

function defaultWorkspaceRoot() {
  return path.join(os.homedir(), "workspace");
}

function defaultUramRoot() {
  return path.join(defaultWorkspaceRoot(), "uram");
}

function defaultDownloadsDir() {
  const homeDir = os.homedir();
  const localizedDownloads = path.join(homeDir, "Загрузки");
  const englishDownloads = path.join(homeDir, "Downloads");

  if (fs.existsSync(localizedDownloads)) {
    return localizedDownloads;
  }

  if (fs.existsSync(englishDownloads)) {
    return englishDownloads;
  }

  return englishDownloads;
}

function buildWatchPaths(options = {}) {
  const workspaceRoot = options.workspaceRoot
    ? path.resolve(options.workspaceRoot)
    : defaultWorkspaceRoot();

  const uramRoot = options.uramRoot
    ? path.resolve(options.uramRoot)
    : defaultUramRoot();

  const configPath = options.configPath
    ? path.resolve(options.configPath)
    : path.join(uramRoot, "config", "watch.json");

  const config = options.config && typeof options.config === "object" ? options.config : {};

  const watchRoot = options.watchRoot
    ? path.resolve(options.watchRoot)
    : path.resolve(
        pickFirst(
          config.watchRoot,
          config.runtimeRoot,
          path.join(uramRoot, "runtime", "watch")
        )
      );

  const downloadsDir = path.resolve(
    pickFirst(
      config.downloads,
      config.downloadsDir,
      config.paths && config.paths.downloads,
      defaultDownloadsDir()
    )
  );

  const inboxDir = path.resolve(
    pickFirst(
      config.inbox,
      config.inboxDir,
      config.paths && config.paths.inbox,
      path.join(uramRoot, "intake", "Inbox")
    )
  );

  const processedDir = path.resolve(
    pickFirst(
      config.processed,
      config.processedDir,
      config.paths && config.paths.processed,
      path.join(watchRoot, "processed")
    )
  );

  const processedSourceDir = path.resolve(
    pickFirst(
      config.processedSource,
      config.processedSourceDir,
      config.paths && config.paths.processedSource,
      config.paths && config.paths.processed_source,
      path.join(uramRoot, "intake", "source-processed")
    )
  );

  const lastRun = path.resolve(
    pickFirst(
      config.lastRun,
      config.last_run,
      config.paths && config.paths.lastRun,
      config.paths && config.paths.last_run,
      path.join(watchRoot, "last_run.txt")
    )
  );

  return {
    mode: "legacy-uram",
    workspaceRoot,
    uramRoot,
    watchRoot,
    configPath,
    downloadsDir,
    inboxDir,
    processedDir,
    processedSourceDir,
    lastRun,
  };
}

module.exports = {
  buildWatchPaths,
  defaultWorkspaceRoot,
  defaultUramRoot,
  defaultDownloadsDir,
};
