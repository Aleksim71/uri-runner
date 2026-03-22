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
 * A17.2
 * - добавлен project-owned режим
 * - default остаётся legacy-uram
 * - watcher НЕ меняется
 */

function buildWatchPaths(options = {}) {
  const mode = options.mode || "legacy-uram";

  const workspaceRoot = options.workspaceRoot
    ? path.resolve(options.workspaceRoot)
    : defaultWorkspaceRoot();

  const uramRoot = options.uramRoot
    ? path.resolve(options.uramRoot)
    : defaultUramRoot();

  const config = options.config && typeof options.config === "object"
    ? options.config
    : {};

  const projectRoot = options.projectRoot
    ? path.resolve(options.projectRoot)
    : process.cwd();

  // --- LEGACY MODE (без изменений) ---
  if (mode === "legacy-uram") {
    const watchRoot = path.resolve(
      pickFirst(
        config.watchRoot,
        config.runtimeRoot,
        path.join(uramRoot, "runtime", "watch")
      )
    );

    return {
      mode: "legacy-uram",

      workspaceRoot,
      uramRoot,
      projectRoot,
      watchRoot,

      configPath: options.configPath
        ? path.resolve(options.configPath)
        : path.join(uramRoot, "config", "watch.json"),

      downloadsDir: path.resolve(
        pickFirst(
          config.downloads,
          config.downloadsDir,
          config.paths && config.paths.downloads,
          defaultDownloadsDir()
        )
      ),

      inboxDir: path.resolve(
        pickFirst(
          config.inbox,
          config.inboxDir,
          config.paths && config.paths.inbox,
          path.join(uramRoot, "intake", "Inbox")
        )
      ),

      processedDir: path.resolve(
        pickFirst(
          config.processed,
          config.processedDir,
          config.paths && config.paths.processed,
          path.join(watchRoot, "processed")
        )
      ),

      processedSourceDir: path.resolve(
        pickFirst(
          config.processedSource,
          config.processedSourceDir,
          config.paths && config.paths.processedSource,
          path.join(uramRoot, "intake", "source-processed")
        )
      ),

      lastRun: path.resolve(
        pickFirst(
          config.lastRun,
          config.last_run,
          config.paths && config.paths.lastRun,
          path.join(watchRoot, "last_run.txt")
        )
      ),
    };
  }

  // --- PROJECT-OWNED MODE (новый) ---
  if (mode === "project-owned") {
    const runtimeRoot = path.join(projectRoot, "runtime", "watch");

    return {
      mode: "project-owned",

      workspaceRoot,
      uramRoot,
      projectRoot,
      watchRoot: runtimeRoot,

      // пока config остаётся legacy
      configPath: options.configPath
        ? path.resolve(options.configPath)
        : path.join(uramRoot, "config", "watch.json"),

      // downloads остаётся системный
      downloadsDir: path.resolve(
        pickFirst(
          config.downloads,
          config.downloadsDir,
          defaultDownloadsDir()
        )
      ),

      // 🔥 вот главное отличие
      inboxDir: path.join(projectRoot, "Inbox"),

      processedDir: path.join(runtimeRoot, "processed"),
      processedSourceDir: path.join(runtimeRoot, "source-processed"),
      lastRun: path.join(runtimeRoot, "last_run.txt"),
    };
  }

  throw new Error(`Unknown transport mode: ${mode}`);
}

module.exports = {
  buildWatchPaths,
};
