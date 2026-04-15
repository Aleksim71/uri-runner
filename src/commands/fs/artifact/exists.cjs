/* path: src/commands/fs/artifact/exists.cjs */
"use strict";

const { resolveInsideBase, statInfo } = require("../../../lib/fs-command-utils.cjs");

async function fsArtifactExists(input = {}, context = {}) {
  const { resolved } = resolveInsideBase(input.path, context);
  const info = await statInfo(resolved);

  return {
    ok: true,
    path: resolved,
    ...info,
  };
}

module.exports = { fsArtifactExists };
