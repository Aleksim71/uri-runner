"use strict";

/**
 * URAM runner entrypoint.
 *
 * Goal:
 * - provide a stable module for CLI: require("./uram/run.cjs")
 * - delegate real work to ./pipeline.cjs (whatever API shape it has)
 *
 * This file is intentionally defensive: it supports several export styles
 * to avoid breaking when pipeline internals evolve.
 */

function loadPipeline() {
  // eslint-disable-next-line global-require
  return require("./pipeline.cjs");
}

async function callPipeline(mod, argv) {
  // 1) module itself is a function
  if (typeof mod === "function") {
    return await mod(argv);
  }

  // 2) preferred explicit APIs
  if (mod && typeof mod.run === "function") {
    return await mod.run(argv);
  }
  if (mod && typeof mod.main === "function") {
    return await mod.main(argv);
  }

  // 3) alternative naming that we might already have
  if (mod && typeof mod.runUram === "function") {
    return await mod.runUram(argv);
  }
  if (mod && typeof mod.processInbox === "function") {
    return await mod.processInbox(argv);
  }

  const keys = mod && typeof mod === "object" ? Object.keys(mod) : [];
  throw new Error(
    `[uram/run] Unsupported pipeline export shape in src/uram/pipeline.cjs. Exports: ${keys.join(", ")}`
  );
}

/**
 * Run URAM pipeline (used by CLI "run" and "fass").
 * Returns whatever pipeline returns.
 */
async function run(argv = process.argv) {
  const pipeline = loadPipeline();
  return await callPipeline(pipeline, argv);
}

/**
 * Commander-friendly entrypoint style (if someone calls main()).
 */
async function main(argv = process.argv) {
  return await run(argv);
}

module.exports = {
  run,
  main,
};
