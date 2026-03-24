"use strict";

const fsp = require("fs/promises");
const path = require("path");
const { toDurationMs } = require("./error-utils.cjs");

function buildResultArtifact({
  runId,
  executionStatus,
  startedAt,
  finishedAt,
  stepsTotal,
  stepsCompleted,
  failedStep = null,
  planWritten = true,
  traceWritten = true,
  artifactsProduced = true,
  error = null,
}) {
  return {
    version: 1,
    runId,
    executionStatus,
    startedAt,
    finishedAt,
    durationMs: toDurationMs(startedAt, finishedAt),
    stepsTotal,
    stepsCompleted,
    failedStep,
    planWritten,
    traceWritten,
    artifactsProduced,
    error,
  };
}

async function persistResultArtifact({ path: filePath, artifact }) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, JSON.stringify(artifact, null, 2) + "\n", "utf-8");
}

module.exports = {
  buildResultArtifact,
  persistResultArtifact,
};
