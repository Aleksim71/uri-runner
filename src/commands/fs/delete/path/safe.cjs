/* path: src/commands/fs/delete/path/safe.cjs */
"use strict";

const fs = require("fs-extra");
const { resolveInsideBase } = require("../../../../lib/fs-command-utils.cjs");

async function fsDeletePathSafe(input = {}, context = {}) {
  const { baseDir, resolved } = resolveInsideBase(input.path, context, { allowBase: false });

  if (resolved === baseDir) {
    const err = new Error('refusing to delete cwd root');
    err.code = "FS_DELETE_REFUSED";
    throw err;
  }

  const existedBefore = await fs.pathExists(resolved);
  await fs.remove(resolved);

  return {
    ok: true,
    path: resolved,
    existedBefore,
    exists: false,
  };
}

module.exports = { fsDeletePathSafe };
