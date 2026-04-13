/* path: src/cli/commands/piligrim-mark-updated.cjs */
"use strict";

const { markPiligrimUpdated, loadPiligrimState } = require("../lib/piligrim-support.cjs");

async function runPiligrimMarkUpdatedCommand() {
  await markPiligrimUpdated();
  const state = await loadPiligrimState();
  console.log("status: piligrim updated");
  console.log("status: ready for new chat");
  console.log("hint: run `uri handoff`");
  console.log(JSON.stringify(state, null, 2));
}

module.exports = { runPiligrimMarkUpdatedCommand };
