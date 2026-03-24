"use strict";

const fsp = require("fs/promises");
const path = require("path");
const { toDurationMs } = require("./error-utils.cjs");

function buildBaselineVerifyResultArtifact({
  runId,
  verified,
  verifyStatus,
  startedAt,
  finishedAt,
  domains = {},
  error = null,
}) {
  return {
    version: 1,
    runId,
    verified,
    verifyStatus,
    startedAt,
    finishedAt,
    durationMs: toDurationMs(startedAt, finishedAt),
    domains,
    error,
  };
}

async function persistBaselineVerifyResultArtifact({ path: filePath, artifact }) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, JSON.stringify(artifact, null, 2) + "\n", "utf-8");
}

module.exports = {
  buildBaselineVerifyResultArtifact,
  persistBaselineVerifyResultArtifact,
};
