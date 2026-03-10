"use strict";

const path = require("path");
const fs = require("fs-extra");
const unzipper = require("unzipper");

// execa v9+: require("execa") returns an object containing { execa }
const { execa } = require("execa");

/**
 * unzip archive
 */
async function unzip(zipPath, dest) {
  await fs
    .createReadStream(zipPath)
    .pipe(unzipper.Extract({ path: dest }))
    .promise();
}

/**
 * apply git patches
 */
async function applyGitPatches(patchesDir, cwd) {
  const files = await fs.readdir(patchesDir);

  const patchFiles = files.filter((f) => f.endsWith(".patch")).sort(); // stable order

  for (const file of patchFiles) {
    const full = path.join(patchesDir, file);

    console.log(`[patch] applying ${file}`);

    await execa("git", ["apply", full], {
      cwd,
      stdio: "inherit",
    });
  }
}

/**
 * apply REPLACE folder
 */
async function applyReplace(replaceDir, cwd) {
  console.log("[patch] applying REPLACE/");

  await fs.copy(replaceDir, cwd, {
    overwrite: true,
    errorOnExist: false,
  });
}

/**
 * run APPLY.sh
 */
async function runApplyScript(scriptPath, cwd) {
  console.log("[patch] running APPLY.sh");

  await execa("bash", [scriptPath], {
    cwd,
    stdio: "inherit",
  });
}

/**
 * main patch runner
 */
async function runPatch(options) {
  const cwd = options?.cwd || process.cwd();
  const zipPath = options?.zipPath;

  // ✅ workspace could be undefined (caused path.join(undefined, ...))
  // Accept multiple option names for compatibility.
  const workspace =
    options?.workspaceDir ||
    options?.workspace ||
    path.resolve(process.cwd(), ".runner-work");

  if (!zipPath || typeof zipPath !== "string") {
    throw new TypeError("runPatch: options.zipPath must be a string");
  }

  const workDir = path.join(workspace, "patch-work");

  await fs.remove(workDir);
  await fs.ensureDir(workDir);

  console.log(`[patch] unzip ${zipPath}`);

  await unzip(zipPath, workDir);

  const patchesDir = path.join(workDir, "PATCHES");
  const replaceDir = path.join(workDir, "REPLACE");
  const applyScript = path.join(workDir, "APPLY.sh");

  if (await fs.pathExists(patchesDir)) {
    await applyGitPatches(patchesDir, cwd);
  }

  if (await fs.pathExists(replaceDir)) {
    await applyReplace(replaceDir, cwd);
  }

  if (await fs.pathExists(applyScript)) {
    await runApplyScript(applyScript, cwd);
  }

  console.log("[patch] done");
}

module.exports = {
  runPatch,
};
