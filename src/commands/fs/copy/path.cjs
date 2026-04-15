/* path: src/commands/fs/copy/path.cjs */
"use strict";

const fs = require("fs-extra");
const path = require("node:path");
const { resolveInsideBase, statInfo } = require("../../../lib/fs-command-utils.cjs");

async function fsCopyPath(input = {}, context = {}) {
  const fromInput = input.from ?? input.path;
  const toInput = input.to ?? input.target;

  const { resolved: fromPath } = resolveInsideBase(fromInput, context);
  const { resolved: toPath } = resolveInsideBase(toInput, context);

  if (!(await fs.pathExists(fromPath))) {
    const err = new Error(`source not found: ${fromPath}`);
    err.code = "FS_SOURCE_NOT_FOUND";
    throw err;
  }

  await fs.ensureDir(path.dirname(toPath));
  await fs.copy(fromPath, toPath, { overwrite: true });

  const info = await statInfo(toPath);

  return {
    ok: true,
    from: fromPath,
    to: toPath,
    ...info,
  };
}

module.exports = { fsCopyPath };
