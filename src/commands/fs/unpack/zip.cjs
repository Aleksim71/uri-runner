/* path: src/commands/fs/unpack/zip.cjs */
"use strict";

const fs = require("fs-extra");
const unzipper = require("unzipper");
const { resolveInsideBase, statInfo } = require("../../../lib/fs-command-utils.cjs");

async function fsUnpackZip(input = {}, context = {}) {
  const archiveInput = input.archive ?? input.path ?? input.zipPath;
  const targetInput = input.target ?? input.out ?? input.dest;

  const { resolved: archivePath } = resolveInsideBase(archiveInput, context);
  const { resolved: targetPath } = resolveInsideBase(targetInput, context);

  if (!(await fs.pathExists(archivePath))) {
    const err = new Error(`archive not found: ${archivePath}`);
    err.code = "FS_ARCHIVE_NOT_FOUND";
    throw err;
  }

  await fs.ensureDir(targetPath);

  await new Promise((resolve, reject) => {
    fs.createReadStream(archivePath)
      .pipe(unzipper.Extract({ path: targetPath }))
      .on("close", resolve)
      .on("error", reject);
  });

  const info = await statInfo(targetPath);

  return {
    ok: true,
    archive: archivePath,
    target: targetPath,
    ...info,
  };
}

module.exports = { fsUnpackZip };
