/* path: src/commands/fs/write/file.cjs */
"use strict";

const fs = require("fs-extra");
const path = require("node:path");
const { resolveInsideBase, statInfo } = require("../../../lib/fs-command-utils.cjs");

async function fsWriteFile(input = {}, context = {}) {
  const content = input.content == null ? "" : String(input.content);
  const encoding =
    typeof input.encoding === "string" && input.encoding.trim()
      ? input.encoding.trim()
      : "utf8";

  const { resolved } = resolveInsideBase(input.path, context);
  await fs.ensureDir(path.dirname(resolved));
  await fs.writeFile(resolved, content, encoding);

  const info = await statInfo(resolved);

  return {
    ok: true,
    path: resolved,
    encoding,
    bytesWritten: Buffer.byteLength(content, encoding === "utf8" ? "utf8" : undefined),
    ...info,
  };
}

module.exports = { fsWriteFile };
