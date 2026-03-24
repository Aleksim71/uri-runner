"use strict";

const fsp = require("fs/promises");
const path = require("path");
const { toDurationMs } = require("./error-utils.cjs");

function buildRollbackResultArtifact({
  runId,
  rollbackExecuted,
  rollbackStatus,
  startedAt,
  finishedAt,
  domainsPlanned = [],
  domainsRestored = [],
  domainsSkipped = [],
  domainsFailed = [],
  error = null,
}) {
  return {
    version: 1,
    runId,
    rollbackExecuted,
    rollbackStatus,
    startedAt,
    finishedAt,
    durationMs: toDurationMs(startedAt, finishedAt),
    domainsPlanned,
    domainsRestored,
    domainsSkipped,
    domainsFailed,
    error,
  };
}

async function persistRollbackResultArtifact({ path: filePath, artifact }) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, JSON.stringify(artifact, null, 2) + "\n", "utf-8");
}

module.exports = {
  buildRollbackResultArtifact,
  persistRollbackResultArtifact,
};
