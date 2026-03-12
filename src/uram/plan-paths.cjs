"use strict";

const path = require("path");

function getPlansDir(projectBoxDir) {
  return path.join(projectBoxDir, "plans");
}

function getLatestPlanPath(projectBoxDir) {
  return path.join(getPlansDir(projectBoxDir), "latest.plan.json");
}

function getHistoryPlansDir(historyDir) {
  return path.join(historyDir, "plans");
}

function getHistoryPlanPath(historyDir, runId) {
  return path.join(getHistoryPlansDir(historyDir), `${runId}.plan.json`);
}

function getHistoryPlanRelPath(runId) {
  return path.join("history", "plans", `${runId}.plan.json`);
}

module.exports = {
  getPlansDir,
  getLatestPlanPath,
  getHistoryPlansDir,
  getHistoryPlanPath,
  getHistoryPlanRelPath,
};
