"use strict";

const path = require("path");

const {
  runRuntimeGc,
} = require("../../runtime/runtime-gc.cjs");

async function runRuntimeGcCommand(args = []) {
  try {
    const options = parseArgs(args);

    const result = await runRuntimeGc({
      projectRoot: options.projectRoot,
      keepLastRuns: options.keepLastRuns,
      dryRun: options.dryRun,
    });

    console.log("");
    console.log("URI RUNTIME GC");
    console.log("────────────────────────");
    console.log(`projectRoot: ${result.projectRoot || resolveProjectRoot(options.projectRoot)}`);
    console.log(`dryRun: ${String(result.dryRun)}`);
    console.log(`keepLastRuns: ${result.keepLastRuns}`);
    console.log(`scannedRuns: ${result.scannedRuns}`);
    console.log(`keptRuns: ${result.keptRunIds.length}`);
    console.log(`deletedRuns: ${result.deletedRunIds.length}`);
    console.log(`missingRuns: ${result.missingRunIds.length}`);

    if (result.deletedRunIds.length > 0) {
      console.log("");
      console.log("DELETED RUNS");
      for (const runId of result.deletedRunIds) {
        console.log(`- ${runId}`);
      }
    }

    if (result.missingRunIds.length > 0) {
      console.log("");
      console.log("MISSING RUNS");
      for (const runId of result.missingRunIds) {
        console.log(`- ${runId}`);
      }
    }

    console.log("");

    return {
      status: "success",
      ...result,
    };
  } catch (error) {
    console.error("");
    console.error("URI RUNTIME GC ERROR");
    console.error("────────────────────────");
    console.error(error.message);
    console.error("");

    return {
      status: "error",
      error: error.message,
    };
  }
}

function parseArgs(args = []) {
  const input = Array.isArray(args) ? args.slice(0) : [];

  let keepLastRuns;
  let dryRun = false;
  let projectRoot = null;

  for (let i = 0; i < input.length; i += 1) {
    const value = input[i];

    if (value === "--dry-run") {
      dryRun = true;
      continue;
    }

    if (value === "--keep-last-runs") {
      const next = input[i + 1];

      if (next == null) {
        throw new Error("--keep-last-runs requires a number");
      }

      const parsed = Number(next);

      if (!Number.isInteger(parsed) || parsed < 0) {
        throw new Error("--keep-last-runs must be a non-negative integer");
      }

      keepLastRuns = parsed;
      i += 1;
      continue;
    }

    if (projectRoot == null) {
      projectRoot = resolveProjectRoot(value);
      continue;
    }

    throw new Error(`Unexpected argument: ${value}`);
  }

  return {
    keepLastRuns,
    dryRun,
    projectRoot,
  };
}

function resolveProjectRoot(project) {
  if (typeof project === "string" && project.trim() !== "") {
    return path.resolve(process.cwd(), project);
  }

  return process.cwd();
}

module.exports = {
  runRuntimeGcCommand,
};
