/* path: src/lib/fs-command-utils.cjs */
"use strict";

const path = require("node:path");
const fs = require("fs-extra");

function getBaseDir(context = {}) {
  return path.resolve(
    typeof context.cwd === "string" && context.cwd.trim() ? context.cwd : process.cwd()
  );
}

function resolveInsideBase(targetPath, context = {}, { allowBase = true } = {}) {
  if (typeof targetPath !== "string" || !targetPath.trim()) {
    const err = new Error('path is required');
    err.code = "FS_PATH_REQUIRED";
    throw err;
  }

  const baseDir = getBaseDir(context);
  const resolved = path.resolve(targetPath);

  const rel = path.relative(baseDir, resolved);
  const inside = rel === "" ? allowBase : (!rel.startsWith("..") && !path.isAbsolute(rel));

  if (!inside) {
    const err = new Error(`path must stay inside cwd: ${resolved}`);
    err.code = "FS_PATH_OUTSIDE_CWD";
    throw err;
  }

  return { baseDir, resolved };
}

async function statInfo(targetPath) {
  const exists = await fs.pathExists(targetPath);
  if (!exists) {
    return {
      exists: false,
      isFile: false,
      isDirectory: false,
      size: 0,
    };
  }

  const st = await fs.stat(targetPath);
  return {
    exists: true,
    isFile: st.isFile(),
    isDirectory: st.isDirectory(),
    size: Number(st.size || 0),
  };
}

module.exports = {
  getBaseDir,
  resolveInsideBase,
  statInfo,
};
