/* path: src/commands/fs/ensure/dir.cjs */
"use strict";

const fs = require("fs-extra");
const { resolveInsideBase, statInfo } = require("../../../lib/fs-command-utils.cjs");

async function fsEnsureDir(input = {}, context = {}) {
  const { resolved } = resolveInsideBase(input.path, context);
  const existedBefore = await fs.pathExists(resolved);
  await fs.ensureDir(resolved);
  const info = await statInfo(resolved);

  return {
    ok: true,
    path: resolved,
    existedBefore,
    ...info,
  };
}

module.exports = { fsEnsureDir };
