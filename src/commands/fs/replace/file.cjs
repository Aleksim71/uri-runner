/* path: src/commands/fs/replace/file.cjs */
"use strict";

const fs = require("fs-extra");
const { resolveInsideBase, statInfo } = require("../../../lib/fs-command-utils.cjs");

async function fsReplaceFile(input = {}, context = {}) {
  const search = input.search == null ? "" : String(input.search);
  const replace = input.replace == null ? "" : String(input.replace);
  const encoding =
    typeof input.encoding === "string" && input.encoding.trim()
      ? input.encoding.trim()
      : "utf8";

  if (!search) {
    const err = new Error('search is required');
    err.code = "FS_REPLACE_SEARCH_REQUIRED";
    throw err;
  }

  const { resolved } = resolveInsideBase(input.path, context);

  if (!(await fs.pathExists(resolved))) {
    const err = new Error(`file not found: ${resolved}`);
    err.code = "FS_FILE_NOT_FOUND";
    throw err;
  }

  let content = await fs.readFile(resolved, encoding);
  const occurrences = content.split(search).length - 1;
  content = content.split(search).join(replace);
  await fs.writeFile(resolved, content, encoding);

  const info = await statInfo(resolved);

  return {
    ok: true,
    path: resolved,
    occurrences,
    ...info,
  };
}

module.exports = { fsReplaceFile };
