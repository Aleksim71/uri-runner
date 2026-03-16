"use strict";

const { main } = require("./cli/index.cjs");

(async () => {
  try {
    await main(process.argv.slice(2));
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    const code = error && error.code ? `${error.code}: ` : "";
    process.stderr.write(`[uri] fatal error: ${code}${message}\n`);
    process.exitCode = 1;
  }
})();
