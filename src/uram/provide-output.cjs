"use strict";

const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

async function ensureDir(p) {
  await fsp.mkdir(p, { recursive: true });
}

function assertRelativeProjectPath(projectRoot, relPath) {
  if (typeof relPath !== "string" || !relPath.trim()) {
    throw new Error("provide.path must be a non-empty string");
  }

  if (path.isAbsolute(relPath)) {
    throw new Error(`provide.path must be relative: ${relPath}`);
  }

  const normalized = path.normalize(relPath.trim());
  const absPath = path.resolve(projectRoot, normalized);
  const projectAbs = path.resolve(projectRoot);

  const relFromProject = path.relative(projectAbs, absPath);

  if (
    !relFromProject ||
    relFromProject.startsWith("..") ||
    path.isAbsolute(relFromProject)
  ) {
    throw new Error(`provide.path escapes project root: ${relPath}`);
  }

  return {
    normalized: relFromProject.split(path.sep).join("/"),
    absPath,
  };
}

function makeFragmentFileName(normalizedPath, startLine, endLine) {
  const safeBase = normalizedPath.replace(/[\\/]/g, "_").replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${safeBase}_${startLine}_${endLine}.txt`;
}

async function copyFileProvide({
  item,
  projectRoot,
  providedDir,
}) {
  const { normalized, absPath } = assertRelativeProjectPath(projectRoot, item.path);

  const stat = await fsp.stat(absPath);
  if (!stat.isFile()) {
    throw new Error(`provide file is not a regular file: ${item.path}`);
  }

  const targetAbs = path.join(providedDir, normalized);
  await ensureDir(path.dirname(targetAbs));
  await fsp.copyFile(absPath, targetAbs);

  return {
    kind: "file",
    path: `provided/${normalized}`,
  };
}

async function copyFileFragmentProvide({
  item,
  projectRoot,
  providedDir,
}) {
  const { normalized, absPath } = assertRelativeProjectPath(projectRoot, item.path);

  if (
    !Array.isArray(item.lines) ||
    item.lines.length !== 2 ||
    !Number.isInteger(item.lines[0]) ||
    !Number.isInteger(item.lines[1])
  ) {
    throw new Error(
      `provide file_fragment lines must be [start, end]: ${item.path}`
    );
  }

  const [startLine, endLine] = item.lines;

  if (startLine < 1 || endLine < startLine) {
    throw new Error(
      `provide file_fragment lines are invalid: ${item.path}`
    );
  }

  const raw = await fsp.readFile(absPath, "utf8");
  const lines = raw.split(/\r?\n/);
  const fragment = lines.slice(startLine - 1, endLine).join("\n");

  const fragmentsDir = path.join(providedDir, "fragments");
  await ensureDir(fragmentsDir);

  const fragmentFileName = makeFragmentFileName(normalized, startLine, endLine);
  const fragmentAbs = path.join(fragmentsDir, fragmentFileName);

  await fsp.writeFile(fragmentAbs, fragment, "utf8");

  return {
    kind: "file_fragment",
    path: `provided/fragments/${fragmentFileName}`,
    source: normalized,
    lines: [startLine, endLine],
  };
}

async function collectProvideOutputs({
  provide,
  projectRoot,
  tmpRoot,
  runId,
  tolerateErrors = false,
}) {
  const items = Array.isArray(provide) ? provide : [];

  if (items.length === 0) {
    return {
      provided: [],
      tmpProvidedDir: null,
    };
  }

  const token = crypto.randomBytes(4).toString("hex");
  const tmpProvidedDir = path.join(tmpRoot, `outbox-provided-${runId}-${token}`);
  const providedDir = path.join(tmpProvidedDir, "provided");

  await ensureDir(providedDir);

  const provided = [];

  for (const item of items) {
    try {
      if (!item || typeof item !== "object") {
        throw new Error("provide item must be an object");
      }

      if (item.kind === "file") {
        provided.push(
          await copyFileProvide({
            item,
            projectRoot,
            providedDir,
          })
        );
        continue;
      }

      if (item.kind === "file_fragment") {
        provided.push(
          await copyFileFragmentProvide({
            item,
            projectRoot,
            providedDir,
          })
        );
        continue;
      }

      throw new Error(`unsupported provide kind: ${item.kind}`);
    } catch (error) {
      if (!tolerateErrors) {
        throw error;
      }
    }
  }

  return {
    provided,
    tmpProvidedDir,
  };
}

module.exports = {
  collectProvideOutputs,
};
