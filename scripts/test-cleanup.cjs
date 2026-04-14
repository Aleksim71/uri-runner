/* path: scripts/test-cleanup.cjs */
"use strict";

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.resolve(__dirname, "..");

function runGitRestore(paths) {
  if (!Array.isArray(paths) || paths.length === 0) {
    return;
  }

  try {
    execFileSync("git", ["restore", "--", ...paths], {
      cwd: root,
      stdio: "inherit",
    });
  } catch (error) {
    console.warn("[test-cleanup] git restore skipped or failed:", error.message);
  }
}

function removeFile(relativePath) {
  const target = path.join(root, relativePath);
  try {
    if (fs.existsSync(target) && fs.statSync(target).isFile()) {
      fs.rmSync(target, { force: true });
      console.log(`[test-cleanup] removed file: ${relativePath}`);
    }
  } catch (error) {
    console.warn(`[test-cleanup] failed to remove file ${relativePath}: ${error.message}`);
  }
}

function removeDir(relativePath) {
  const target = path.join(root, relativePath);
  try {
    if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
      fs.rmSync(target, { recursive: true, force: true });
      console.log(`[test-cleanup] removed dir: ${relativePath}`);
    }
  } catch (error) {
    console.warn(`[test-cleanup] failed to remove dir ${relativePath}: ${error.message}`);
  }
}

function walkAndRemoveTmpOutbox(currentDir) {
  let entries = [];
  try {
    entries = fs.readdirSync(currentDir, { withFileTypes: true });
  } catch (error) {
    console.warn(`[test-cleanup] failed to read dir ${currentDir}: ${error.message}`);
    return;
  }

  for (const entry of entries) {
    const absolutePath = path.join(currentDir, entry.name);
    if (!entry.isDirectory()) {
      continue;
    }

    if (entry.name === ".git" || entry.name === "node_modules") {
      continue;
    }

    if (entry.name === ".tmp-outbox") {
      try {
        fs.rmSync(absolutePath, { recursive: true, force: true });
        console.log(`[test-cleanup] removed dir: ${path.relative(root, absolutePath)}`);
      } catch (error) {
        console.warn(
          `[test-cleanup] failed to remove dir ${path.relative(root, absolutePath)}: ${error.message}`
        );
      }
      continue;
    }

    walkAndRemoveTmpOutbox(absolutePath);
  }
}

console.log("[test-cleanup] start");

runGitRestore([
  "runtime/piligrim/state.json",
  "runtime/watch/goal-state.json",
  "runtime/watch/last_run.txt",
  "test/real/cases",
]);

removeFile("browser-artifact.json");

[
  ".tmp-truth-stress",
  "logs",
  "tempasiBox",
  "uri-runner-nextBox",
].forEach(removeDir);

walkAndRemoveTmpOutbox(path.join(root, "test", "real"));

console.log("[test-cleanup] done");
