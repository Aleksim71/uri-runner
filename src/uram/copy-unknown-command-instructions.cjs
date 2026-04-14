/* path: src/uram/copy-unknown-command-instructions.cjs */
"use strict";

const fs = require("fs/promises");
const path = require("path");

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function detectUnknownCommand(outboxPayload) {
  if (!isObject(outboxPayload)) {
    return false;
  }

  const status =
    typeof outboxPayload.status === "string" ? outboxPayload.status.trim() : "";

  if (status !== "classification_required") {
    return false;
  }

  const error = outboxPayload.error;
  if (isObject(error)) {
    const type =
      typeof error.type === "string" ? error.type.trim().toLowerCase() : "";
    const code =
      typeof error.code === "string" ? error.code.trim().toLowerCase() : "";
    const message =
      typeof error.message === "string" ? error.message.trim().toLowerCase() : "";

    if (
      type === "unknown_command" ||
      code === "unknown_command" ||
      message.includes("unknown command") ||
      message.includes("not registered")
    ) {
      return true;
    }
  }

  const checks = Array.isArray(outboxPayload.checks) ? outboxPayload.checks : [];
  return checks.some((check) => {
    if (!isObject(check)) {
      return false;
    }

    const name =
      typeof check.name === "string" ? check.name.trim().toLowerCase() : "";
    const status =
      typeof check.status === "string" ? check.status.trim().toLowerCase() : "";
    const summary =
      typeof check.summary === "string" ? check.summary.trim().toLowerCase() : "";

    return (
      name === "registry_lookup" &&
      (status === "failed" ||
        summary.includes("not registered") ||
        summary.includes("unknown command"))
    );
  });
}

async function copyDirRecursive(srcDir, destDir) {
  await fs.mkdir(destDir, { recursive: true });
  const entries = await fs.readdir(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      await copyDirRecursive(srcPath, destPath);
      continue;
    }

    if (entry.isFile()) {
      await fs.mkdir(path.dirname(destPath), { recursive: true });
      await fs.copyFile(srcPath, destPath);
    }
  }
}

async function copyUnknownCommandInstructionsToStaging({
  stagingRoot,
  outboxPayload,
  instructionsSourceDir,
}) {
  if (!detectUnknownCommand(outboxPayload)) {
    return {
      copied: false,
      reason: "not_unknown_command",
      files: [],
      sourceDir: instructionsSourceDir,
      targetDir: path.join(stagingRoot, "REPORT", "instructions"),
    };
  }

  const sourceDir = path.resolve(instructionsSourceDir);
  const targetDir = path.join(stagingRoot, "REPORT", "instructions");

  let sourceStat = null;
  try {
    sourceStat = await fs.stat(sourceDir);
  } catch {
    sourceStat = null;
  }

  if (!sourceStat || !sourceStat.isDirectory()) {
    if (isObject(outboxPayload)) {
      outboxPayload.instructions = {
        source: sourceDir,
        target: targetDir,
        included: [],
        trigger: "unknown_command",
        error: "instructions_source_missing",
      };
    }

    return {
      copied: false,
      reason: "missing_source_dir",
      files: [],
      sourceDir,
      targetDir,
    };
  }

  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort();

  await copyDirRecursive(sourceDir, targetDir);

  if (isObject(outboxPayload)) {
    outboxPayload.instructions = {
      source: sourceDir,
      target: "REPORT/instructions",
      included: files,
      trigger: "unknown_command",
    };
  }

  return {
    copied: true,
    reason: "ok",
    files,
    sourceDir,
    targetDir,
  };
}

module.exports = {
  detectUnknownCommand,
  copyUnknownCommandInstructionsToStaging,
};
