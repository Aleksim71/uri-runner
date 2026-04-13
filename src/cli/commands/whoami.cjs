/* path: src/cli/commands/whoami.cjs */
"use strict";

const path = require("path");
const { createWhoAmIOutbox } = require("../lib/piligrim-support.cjs");

async function runWhoAmICommand() {
  const outboxZipPath = path.resolve("Outbox/outbox.zip");
  const result = await createWhoAmIOutbox({ outboxZipPath });
  console.log("status: success");
  console.log(`outbox: ${result.outboxZipPath}`);
}

module.exports = { runWhoAmICommand };
