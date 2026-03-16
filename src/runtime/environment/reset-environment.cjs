"use strict";

const { stopManagedProcesses } = require("./stop-managed-processes.cjs");
const { cleanupRuntimeState } = require("./cleanup-runtime-state.cjs");
const { startManagedServer } = require("./start-managed-server.cjs");
const { runHealthcheck } = require("./run-healthcheck.cjs");

async function resetEnvironment({
  environment = {},
  cwd,
  workspaceDir = null,
  runtimePaths = null,
  stopManagedProcessesFn = stopManagedProcesses,
  cleanupRuntimeStateFn = cleanupRuntimeState,
  startManagedServerFn = startManagedServer,
  runHealthcheckFn = runHealthcheck,
} = {}) {
  const policy =
    environment && typeof environment === "object" && !Array.isArray(environment)
      ? environment
      : {};

  const managedProcesses = Array.isArray(policy.managed_processes)
    ? policy.managed_processes
    : [];

  const startup =
    policy.startup && typeof policy.startup === "object" && !Array.isArray(policy.startup)
      ? policy.startup
      : {};

  const healthcheck =
    startup.healthcheck &&
    typeof startup.healthcheck === "object" &&
    !Array.isArray(startup.healthcheck)
      ? { ...startup.healthcheck }
      : null;

  const cleanupScopePaths = [cwd, workspaceDir].filter(
    (value) => typeof value === "string" && value.trim().length > 0
  );

  const cleanupExactPaths = [];

  if (
    runtimePaths &&
    typeof runtimePaths === "object" &&
    typeof runtimePaths.runTmpDir === "string" &&
    runtimePaths.runTmpDir.trim().length > 0
  ) {
    cleanupExactPaths.push(runtimePaths.runTmpDir);
  }

  const stopSummary = await stopManagedProcessesFn({
    managedProcesses,
  });

  const cleanupSummary = await cleanupRuntimeStateFn({
    scopePaths: cleanupScopePaths,
    exactPaths: cleanupExactPaths,
  });

  const startupSummary = await startManagedServerFn({
    startup,
    cwd,
  });

  let effectiveHealthcheck = healthcheck;
  if (
    effectiveHealthcheck &&
    effectiveHealthcheck.type === "process_alive" &&
    (!Number.isInteger(effectiveHealthcheck.pid) || effectiveHealthcheck.pid <= 0) &&
    Number.isInteger(startupSummary?.pid) &&
    startupSummary.pid > 0
  ) {
    effectiveHealthcheck = {
      ...effectiveHealthcheck,
      pid: startupSummary.pid,
    };
  }

  let healthcheckSummary = {
    attempted: false,
    passed: true,
    skipped: true,
  };

  const shouldRunHealthcheck =
    effectiveHealthcheck &&
    typeof effectiveHealthcheck === "object" &&
    (
      effectiveHealthcheck.type === "http_ok" ||
      effectiveHealthcheck.type === "port_open" ||
      effectiveHealthcheck.type === "process_alive"
    );

  if (shouldRunHealthcheck) {
    healthcheckSummary = await runHealthcheckFn({
      healthcheck: effectiveHealthcheck,
    });

    if (!healthcheckSummary.passed) {
      const error = new Error("Environment reset healthcheck failed");
      error.code = "ENVIRONMENT_HEALTHCHECK_FAILED";
      error.details = {
        stopSummary,
        cleanupSummary,
        startupSummary,
        healthcheckSummary,
      };
      throw error;
    }
  }

  return {
    attempted: true,
    stopSummary,
    cleanupSummary,
    startupSummary,
    healthcheckSummary,
  };
}

module.exports = {
  resetEnvironment,
};
