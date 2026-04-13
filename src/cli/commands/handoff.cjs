/* path: src/cli/commands/handoff.cjs */
"use strict";

const { createHandoffOutbox } = require("../lib/piligrim-support.cjs");

async function runHandoffCommand() {
  const result = await createHandoffOutbox();
  console.log("status: success");
  console.log("status: ready for new chat");
  console.log(`outbox: ${result.outboxZipPath}`);
}

module.exports = { runHandoffCommand };
