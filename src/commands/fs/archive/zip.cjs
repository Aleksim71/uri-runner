/* path: src/commands/fs/archive/zip.cjs */
"use strict";

const fs = require("fs-extra");
const path = require("node:path");
const archiver = require("archiver");
const { resolveInsideBase, statInfo } = require("../../../lib/fs-command-utils.cjs");

async function fsArchiveZip(input = {}, context = {}) {
  const sourceInput = input.source ?? input.path;
  const targetInput = input.target ?? input.out ?? input.zipPath;

  const { resolved: sourcePath } = resolveInsideBase(sourceInput, context);
  const { resolved: targetPath } = resolveInsideBase(targetInput, context);

  if (!(await fs.pathExists(sourcePath))) {
    const err = new Error(`source not found: ${sourcePath}`);
    err.code = "FS_SOURCE_NOT_FOUND";
    throw err;
  }

  await fs.ensureDir(path.dirname(targetPath));

  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(targetPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", resolve);
    output.on("error", reject);
    archive.on("error", reject);

    archive.pipe(output);

    const st = fs.statSync(sourcePath);
    if (st.isDirectory()) {
      archive.directory(sourcePath, false);
    } else {
      archive.file(sourcePath, { name: path.basename(sourcePath) });
    }

    archive.finalize();
  });

  const info = await statInfo(targetPath);

  return {
    ok: true,
    source: sourcePath,
    target: targetPath,
    ...info,
  };
}

module.exports = { fsArchiveZip };
