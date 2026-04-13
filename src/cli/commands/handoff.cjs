/* path: src/cli/commands/handoff.cjs */
"use strict";

const path = require("path");
const { createHandoffOutbox } = require("../lib/piligrim-support.cjs");

async function runHandoffCommand() {
  const outboxZipPath = path.resolve("Outbox/outbox.zip");
  const result = await createHandoffOutbox({ outboxZipPath });
  console.log("status: success");
  console.log("status: ready for new chat");
  console.log(`outbox: ${result.outboxZipPath}`);
}

module.exports = { runHandoffCommand };
