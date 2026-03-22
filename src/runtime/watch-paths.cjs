// src/runtime/watch-paths.cjs

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
  const localized = path.join(homeDir, "Загрузки");
  const english = path.join(homeDir, "Downloads");

  if (fs.existsSync(localized)) return localized;
  if (fs.existsSync(english)) return english;

  return english;
}

/**
 * A17.5
 * - explicit config overrides always win
 * - project-owned mode changes fallback defaults for watchRoot, processedDir, lastRun, inboxDir
 * - downloads/processedSource stay legacy by default
 */

function buildWatchPaths(options = {}) {
  const mode = options.mode || "legacy-uram";

  const workspaceRoot = options.workspaceRoot
    ? path.resolve(options.workspaceRoot)
    : defaultWorkspaceRoot();

  const uramRoot = options.uramRoot
    ? path.resolve(options.uramRoot)
    : defaultUramRoot();

  const config =
    options.config && typeof options.config === "object" ? options.config : {};

  const projectRoot = options.projectRoot
    ? path.resolve(options.projectRoot)
    : process.cwd();

  const legacyWatchRoot = path.join(uramRoot, "runtime", "watch");
  const projectWatchRoot = path.join(projectRoot, "runtime", "watch");

  const watchRoot = path.resolve(
    pickFirst(
      config.watchRoot,
      config.runtimeRoot,
      mode === "project-owned" ? projectWatchRoot : legacyWatchRoot
    )
  );

  const legacyInboxDir = path.join(uramRoot, "intake", "Inbox");
  const projectInboxDir = path.join(projectRoot, "Inbox");
  const legacyProcessedSourceDir = path.join(uramRoot, "intake", "source-processed");

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
      mode === "project-owned" ? projectInboxDir : legacyInboxDir
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
      legacyProcessedSourceDir
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
    mode,
    workspaceRoot,
    uramRoot,
    projectRoot,
    watchRoot,

    configPath: options.configPath
      ? path.resolve(options.configPath)
      : path.join(uramRoot, "config", "watch.json"),

    downloadsDir,
    inboxDir,
    processedDir,
    processedSourceDir,
    lastRun,
  };
}

module.exports = {
  buildWatchPaths,
};
