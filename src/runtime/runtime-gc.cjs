"use strict";

const fsp = require("fs/promises");
const path = require("path");

const {
  readHistoryIndex,
} = require("./history/read-history-index.cjs");

const DEFAULT_KEEP_LAST_RUNS = 100;

async function runRuntimeGc({
  projectRoot,
  keepLastRuns = DEFAULT_KEEP_LAST_RUNS,
  dryRun = false,
} = {}) {
  const resolvedProjectRoot = resolveProjectRoot(projectRoot);
  const runtimeRoot = path.join(resolvedProjectRoot, "runtime");
  const runsDir = path.join(runtimeRoot, "runs");
  const historyIndexPath = path.join(runtimeRoot, "history", "index.json");

  const normalizedKeepLastRuns = normalizeKeepLastRuns(keepLastRuns);

  const { exists, index } = await readHistoryIndex({
    historyIndexPath,
  });

  if (!exists || !Array.isArray(index.runs) || index.runs.length === 0) {
    return {
      ok: true,
      projectRoot: resolvedProjectRoot,
      dryRun,
      keepLastRuns: normalizedKeepLastRuns,
      deletedRunIds: [],
      missingRunIds: [],
      keptRunIds: [],
      scannedRuns: 0,
    };
  }

  const sortedRuns = index.runs
    .slice()
    .sort(compareRunsDesc);

  const keptRuns = sortedRuns.slice(0, normalizedKeepLastRuns);
  const deletedCandidates = sortedRuns.slice(normalizedKeepLastRuns);

  const keptRunIds = keptRuns.map((run) => run.runId);
  const deletedRunIds = [];
  const missingRunIds = [];

  for (const run of deletedCandidates) {
    const runDir = path.join(runsDir, run.runId);

    if (!(await pathExists(runDir))) {
      missingRunIds.push(run.runId);
      continue;
    }

    if (!dryRun) {
      await fsp.rm(runDir, { recursive: true, force: true });
    }

    deletedRunIds.push(run.runId);
  }

  return {
    ok: true,
    projectRoot: resolvedProjectRoot,
    dryRun,
    keepLastRuns: normalizedKeepLastRuns,
    deletedRunIds,
    missingRunIds,
    keptRunIds,
    scannedRuns: sortedRuns.length,
  };
}

function compareRunsDesc(a, b) {
  const aDate = normalizeDate(a?.createdAt);
  const bDate = normalizeDate(b?.createdAt);

  if (aDate && bDate && aDate !== bDate) {
    return bDate.localeCompare(aDate);
  }

  if (!a?.runId) return 1;
  if (!b?.runId) return -1;

  return String(b.runId).localeCompare(String(a.runId));
}

function normalizeDate(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function normalizeKeepLastRuns(value) {
  if (!Number.isInteger(value) || value < 0) {
    return DEFAULT_KEEP_LAST_RUNS;
  }

  return value;
}

function resolveProjectRoot(projectRoot) {
  if (typeof projectRoot === "string" && projectRoot.trim() !== "") {
    return path.resolve(projectRoot);
  }

  return process.cwd();
}

async function pathExists(targetPath) {
  try {
    await fsp.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  DEFAULT_KEEP_LAST_RUNS,
  runRuntimeGc,
  compareRunsDesc,
  normalizeKeepLastRuns,
};
