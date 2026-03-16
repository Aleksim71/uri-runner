"use strict";

const path = require("path");

function getRunsDir(historyDir) {
  return path.join(historyDir, "runs");
}

function getRunDir({ historyDir, runId }) {
  return path.join(getRunsDir(historyDir), runId);
}

function getResultPath({ historyDir, runId }) {
  return path.join(getRunDir({ historyDir, runId }), "RESULT.json");
}

function getRollbackResultPath({ historyDir, runId }) {
  return path.join(getRunDir({ historyDir, runId }), "ROLLBACK_RESULT.json");
}

function getBaselineVerifyResultPath({ historyDir, runId }) {
  return path.join(
    getRunDir({ historyDir, runId }),
    "BASELINE_VERIFY_RESULT.json"
  );
}

function getRunSummaryPath({ historyDir, runId }) {
  return path.join(getRunDir({ historyDir, runId }), "RUN_SUMMARY.json");
}

function getBaselineDir({ historyDir, runId }) {
  return path.join(getRunDir({ historyDir, runId }), "baseline");
}

function getBaselineMetaPath({ historyDir, runId }) {
  return path.join(getBaselineDir({ historyDir, runId }), "BASELINE_META.json");
}

module.exports = {
  getRunsDir,
  getRunDir,
  getResultPath,
  getRollbackResultPath,
  getBaselineVerifyResultPath,
  getRunSummaryPath,
  getBaselineDir,
  getBaselineMetaPath,
};
