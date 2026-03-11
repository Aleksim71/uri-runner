"use strict";

const fs = require("fs/promises");
const path = require("path");
const YAML = require("yaml");

async function loadExecutableContext(projectCtx) {
  const file = path.join(projectCtx.cwd, "contexts/system/executable.yaml");

  try {
    const txt = await fs.readFile(file, "utf8");
    const ctx = YAML.parse(txt);

    if (!ctx || ctx.version !== 1) {
      throw new Error("invalid executable context version");
    }

    return ctx;
  } catch (err) {
    throw new Error(
      `[uri] executable context missing: ${file}`
    );
  }
}

module.exports = { loadExecutableContext };
