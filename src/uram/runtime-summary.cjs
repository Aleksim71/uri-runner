"use strict";

const {
  buildRunSummaryArtifact,
  persistRunSummaryArtifact,
} = require("./artifacts/run-summary-artifact.cjs");
const { getRunSummaryPath } = require("./run-paths.cjs");

function deriveFinalRunStatus({
  executionStatus,
  rollbackStatus,
  verifyStatus,
}) {
  const restored = rollbackStatus === "restored";
  const verified = verifyStatus === "verified";

  if (executionStatus === "success" && restored && verified) {
    return "success";
  }

  if (
    (executionStatus === "failed" || executionStatus === "crashed") &&
    restored &&
    verified
  ) {
    return "failed_restored";
  }

  return "unsafe";
}

function computeSafeToContinue({ finalStatus }) {
  return finalStatus === "success" || finalStatus === "failed_restored";
}

function buildFinalFlags({ rollbackResult, baselineVerifyResult }) {
  return {
    baselineRestored: rollbackResult?.rollbackStatus === "restored",
    baselineVerified: baselineVerifyResult?.verifyStatus === "verified",
  };
}

async function finalizeRuntimeSummary({
  historyDir,
  runId,
  startedAt,
  finishedAt,
  result,
  rollbackResult,
  baselineVerifyResult,
}) {
  const finalStatus = deriveFinalRunStatus({
    executionStatus: result.executionStatus,
    rollbackStatus: rollbackResult.rollbackStatus,
    verifyStatus: baselineVerifyResult.verifyStatus,
  });

  const safeToContinue = computeSafeToContinue({ finalStatus });
  const { baselineRestored, baselineVerified } = buildFinalFlags({
    rollbackResult,
    baselineVerifyResult,
  });

  const artifact = buildRunSummaryArtifact({
    runId,
    finalStatus,
    safeToContinue,
    executionStatus: result.executionStatus,
    rollbackStatus: rollbackResult.rollbackStatus,
    verifyStatus: baselineVerifyResult.verifyStatus,
    baselineRestored,
    baselineVerified,
    startedAt,
    finishedAt,
    artifacts: {
      result: "RESULT.json",
      rollbackResult: "ROLLBACK_RESULT.json",
      baselineVerifyResult: "BASELINE_VERIFY_RESULT.json",
      runSummary: "RUN_SUMMARY.json",
      baselineMeta: "baseline/BASELINE_META.json",
    },
  });

  await persistRunSummaryArtifact({
    path: getRunSummaryPath({ historyDir, runId }),
    artifact,
  });

  return artifact;
}

module.exports = {
  deriveFinalRunStatus,
  computeSafeToContinue,
  buildFinalFlags,
  finalizeRuntimeSummary,
};
