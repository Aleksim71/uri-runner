/* path: src/commands/fs/read/file.cjs */
"use strict";

const fs = require("fs-extra");
const { resolveInsideBase } = require("../../../lib/fs-command-utils.cjs");

async function fsReadFile(input = {}, context = {}) {
  const encoding =
    typeof input.encoding === "string" && input.encoding.trim()
      ? input.encoding.trim()
      : "utf8";

  const { resolved } = resolveInsideBase(input.path, context);

  if (!(await fs.pathExists(resolved))) {
    const err = new Error(`file not found: ${resolved}`);
    err.code = "FS_FILE_NOT_FOUND";
    throw err;
  }

  const st = await fs.stat(resolved);
  if (!st.isFile()) {
    const err = new Error(`path is not a file: ${resolved}`);
    err.code = "FS_NOT_A_FILE";
    throw err;
  }

  const content = await fs.readFile(resolved, encoding);

  return {
    ok: true,
    path: resolved,
    encoding,
    content,
    size: Number(st.size || 0),
  };
}

module.exports = { fsReadFile };
