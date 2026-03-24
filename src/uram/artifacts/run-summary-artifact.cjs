"use strict";

const fsp = require("fs/promises");
const path = require("path");
const { toDurationMs } = require("./error-utils.cjs");

function buildRunSummaryArtifact({
  runId,
  finalStatus,
  safeToContinue,
  executionStatus,
  rollbackStatus,
  verifyStatus,
  baselineRestored,
  baselineVerified,
  startedAt,
  finishedAt,
  artifacts,
}) {
  return {
    version: 1,
    runId,
    finalStatus,
    safeToContinue,
    executionStatus,
    rollbackStatus,
    verifyStatus,
    baselineRestored,
    baselineVerified,
    startedAt,
    finishedAt,
    durationMs: toDurationMs(startedAt, finishedAt),
    artifacts,
  };
}

async function persistRunSummaryArtifact({ path: filePath, artifact }) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, JSON.stringify(artifact, null, 2) + "\n", "utf-8");
}

module.exports = {
  buildRunSummaryArtifact,
  persistRunSummaryArtifact,
};
