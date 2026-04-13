/* path: src/cli/commands/whoami.cjs */
"use strict";

const { createWhoAmIOutbox } = require("../lib/piligrim-support.cjs");

async function runWhoAmICommand() {
  const result = await createWhoAmIOutbox();
  console.log("status: success");
  console.log(`outbox: ${result.outboxZipPath}`);
}

module.exports = { runWhoAmICommand };
