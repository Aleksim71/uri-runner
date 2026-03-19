// path: src/runtime/finalize-run.cjs
"use strict";

const { buildRuntimeResult } = require("./result-builder.cjs");

function finalizeRuntimeResult(input = {}) {
  return buildRuntimeResult(input);
}

function toPipelineReturn(result) {
  const runtimeResult = buildRuntimeResult(result);

  return {
    runId: runtimeResult.runId,
    project: runtimeResult.project,
    engine: runtimeResult.engine,
    exitCode: runtimeResult.exitCode,
    ok: runtimeResult.ok,
    executableCtx: runtimeResult.executableCtx,
    loadedCommands: runtimeResult.loadedCommands,
    fileDeliveryReport: runtimeResult.fileDeliveryReport,
    ...(runtimeResult.meta || {}),
  };
}

function toHistoryEntryExtras(result) {
  const runtimeResult = buildRuntimeResult(result);

  return {
    exitCode: runtimeResult.exitCode,
    errorCode: runtimeResult.error?.code || null,
  };
}

function toOutboxReport(result) {
  const runtimeResult = buildRuntimeResult(result);
  return runtimeResult.outboxPayload;
}

module.exports = {
  finalizeRuntimeResult,
  toPipelineReturn,
  toHistoryEntryExtras,
  toOutboxReport,
};
