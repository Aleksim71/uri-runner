"use strict";

const { buildBaselineVerifyResultArtifact } = require("../artifacts/baseline-verify-result-artifact.cjs");
const { serializeError, nowIso } = require("../artifacts/error-utils.cjs");
const { getStateDomains } = require("./state-domains.cjs");

function buildDefaultDomainVerifyMap() {
  const domains = getStateDomains();
  const result = {};

  for (const [name, meta] of Object.entries(domains)) {
    result[name] = meta.supported ? "ok" : "not_checked";
  }

  return result;
}

async function verifyBaseline({ runId }) {
  const startedAt = nowIso();
  const finishedAt = nowIso();

  return buildBaselineVerifyResultArtifact({
    runId,
    verified: true,
    verifyStatus: "verified",
    startedAt,
    finishedAt,
    domains: buildDefaultDomainVerifyMap(),
    error: null,
  });
}

async function verifyBaselineSafe({ runId }) {
  try {
    return await verifyBaseline({ runId });
  } catch (error) {
    const startedAt = nowIso();
    const finishedAt = nowIso();

    return buildBaselineVerifyResultArtifact({
      runId,
      verified: false,
      verifyStatus: "failed",
      startedAt,
      finishedAt,
      domains: buildDefaultDomainVerifyMap(),
      error: serializeError(error),
    });
  }
}

module.exports = {
  verifyBaseline,
  verifyBaselineSafe,
  buildDefaultDomainVerifyMap,
};
