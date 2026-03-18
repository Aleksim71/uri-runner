"use strict";

const os = require("os");
const path = require("path");

const { runUramPipeline } = require("./pipeline.cjs");

function normalizeKnownError(error) {
  if (!error || typeof error !== "object") {
    return {
      name: "Error",
      code: "PIPELINE_INTERNAL_ERROR",
      message: String(error),
      details: {},
    };
  }

  return {
    name:
      typeof error.name === "string" && error.name.trim()
        ? error.name
        : "Error",
    code:
      typeof error.code === "string" && error.code.trim()
        ? error.code
        : "PIPELINE_INTERNAL_ERROR",
    message:
      typeof error.message === "string" && error.message.trim()
        ? error.message
        : "Unknown runtime error",
    details:
      error.details && typeof error.details === "object" && !Array.isArray(error.details)
        ? error.details
        : {},
  };
}

async function run(params = {}) {
  const uramCli =
    typeof params.uram === "string" && params.uram.trim()
      ? params.uram.trim()
      : typeof params.uramCli === "string" && params.uramCli.trim()
        ? params.uramCli.trim()
        : null;

  const workspaceCli =
    typeof params.workspace === "string" && params.workspace.trim()
      ? params.workspace.trim()
      : typeof params.workspaceCli === "string" && params.workspaceCli.trim()
        ? params.workspaceCli.trim()
        : null;

  const quiet = params.quiet === true;

  try {
    return await runUramPipeline({
      uramCli,
      workspaceCli,
      quiet,
      env: process.env,
      homeDir: os.homedir(),
    });
  } catch (error) {
    const normalized = normalizeKnownError(error);

    return {
      runId: null,
      project: "unknown",
      engine: "unknown",
      exitCode: 1,
      ok: false,
      executableCtx: null,
      loadedCommands: [],
      error: normalized,
      tmpProvidedDir: null,
    };
  }
}

async function runFromCli(args = {}) {
  const input =
    args && typeof args === "object" && !Array.isArray(args) ? args : {};

  return run({
    uram:
      typeof input.uram === "string"
        ? input.uram
        : typeof input.uramCli === "string"
          ? input.uramCli
          : null,
    workspace:
      typeof input.workspace === "string"
        ? input.workspace
        : typeof input.workspaceCli === "string"
          ? input.workspaceCli
          : null,
    quiet: input.quiet === true,
  });
}

function resolveUramArg(argv = []) {
  const items = Array.isArray(argv) ? argv : [];

  for (let i = 0; i < items.length; i += 1) {
    const token = items[i];

    if (token === "--uram" && typeof items[i + 1] === "string") {
      return items[i + 1];
    }

    if (typeof token === "string" && token.startsWith("--uram=")) {
      return token.slice("--uram=".length);
    }
  }

  return null;
}

function resolveWorkspaceArg(argv = []) {
  const items = Array.isArray(argv) ? argv : [];

  for (let i = 0; i < items.length; i += 1) {
    const token = items[i];

    if (token === "--workspace" && typeof items[i + 1] === "string") {
      return items[i + 1];
    }

    if (typeof token === "string" && token.startsWith("--workspace=")) {
      return token.slice("--workspace=".length);
    }
  }

  return null;
}

function resolveQuietArg(argv = []) {
  const items = Array.isArray(argv) ? argv : [];
  return items.includes("--quiet");
}

async function main(argv = process.argv.slice(2)) {
  const result = await runFromCli({
    uram: resolveUramArg(argv),
    workspace: resolveWorkspaceArg(argv),
    quiet: resolveQuietArg(argv),
  });

  if (!result || typeof result !== "object") {
    throw new Error("run() returned invalid result");
  }

  if (!result.ok) {
    process.exitCode = 1;
  }

  return result;
}

module.exports = {
  run,
  runFromCli,
  main,
};
