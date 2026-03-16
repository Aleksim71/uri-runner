"use strict";

const fsp = require("fs/promises");
const { getStateDomains } = require("./state-domains.cjs");
const { getBaselineMetaPath } = require("../run-paths.cjs");

async function captureBaseline({ runId }) {
  return {
    version: 1,
    runId,
    captured: true,
    capturedAt: new Date().toISOString(),
    domains: getStateDomains(),
  };
}

async function persistBaselineMeta({ historyDir, runId, baselineMeta }) {
  const filePath = getBaselineMetaPath({ historyDir, runId });
  await fsp.mkdir(require("path").dirname(filePath), { recursive: true });
  await fsp.writeFile(
    filePath,
    JSON.stringify(baselineMeta, null, 2) + "\n",
    "utf-8"
  );
}

module.exports = {
  captureBaseline,
  persistBaselineMeta,
};
