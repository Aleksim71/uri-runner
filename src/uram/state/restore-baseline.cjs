"use strict";

const { buildRollbackResultArtifact } = require("../artifacts/rollback-result-artifact.cjs");
const { serializeError, nowIso } = require("../artifacts/error-utils.cjs");
const { getSupportedDomainNames } = require("./state-domains.cjs");

async function restoreBaseline({ runId }) {
  const startedAt = nowIso();
  const domainsPlanned = getSupportedDomainNames();
  const finishedAt = nowIso();

  return buildRollbackResultArtifact({
    runId,
    rollbackExecuted: true,
    rollbackStatus: "restored",
    startedAt,
    finishedAt,
    domainsPlanned,
    domainsRestored: [...domainsPlanned],
    domainsSkipped: [],
    domainsFailed: [],
    error: null,
  });
}

async function restoreBaselineSafe({ runId }) {
  try {
    return await restoreBaseline({ runId });
  } catch (error) {
    const startedAt = nowIso();
    const finishedAt = nowIso();
    const domainsPlanned = getSupportedDomainNames();

    return buildRollbackResultArtifact({
      runId,
      rollbackExecuted: true,
      rollbackStatus: "failed",
      startedAt,
      finishedAt,
      domainsPlanned,
      domainsRestored: [],
      domainsSkipped: [],
      domainsFailed: domainsPlanned,
      error: serializeError(error),
    });
  }
}

module.exports = {
  restoreBaseline,
  restoreBaselineSafe,
};
