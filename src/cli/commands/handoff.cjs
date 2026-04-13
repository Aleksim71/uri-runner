/* path: src/cli/commands/handoff.cjs */
"use strict";

const { createHandoffOutbox } = require("../lib/piligrim-support.cjs");

async function runHandoffCommand(args = []) {
  const input = Array.isArray(args) ? args : [];
  const projectName =
    typeof input[0] === "string" && input[0].trim()
      ? input[0].trim()
      : "tempasi";

  const result = await createHandoffOutbox({ projectName });
  console.log("status: success");
  console.log("status: ready for new chat");
  console.log(`project: ${projectName}`);
  console.log(`outbox: ${result.outboxZipPath}`);
}

module.exports = { runHandoffCommand };
