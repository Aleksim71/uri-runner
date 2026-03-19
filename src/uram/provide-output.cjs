// path: src/uram/provide-output.cjs
"use strict";

const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { ERROR_CODES } = require("./error-codes.cjs");

const PROJECT_TREE_REL_PATH = "provided/project-tree.txt";
const DEFAULT_TREE_MAX_DEPTH = 12;
const DEFAULT_TREE_MAX_ENTRIES = 5000;

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
  const safeBase = normalizedPath
    .replace(/[\\/]/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${safeBase}_${startLine}_${endLine}.txt`;
}

function normalizeRequestedPath(item) {
  if (item && typeof item.path === "string" && item.path.trim()) {
    return item.path.trim();
  }
  return "[invalid-request]";
}

function makeFileError(code, message, details = {}) {
  return {
    code,
    message,
    details: normalizeDetails(details),
  };
}

function normalizeDetails(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return { ...value };
}

function mapFsErrorToCode(error, fallbackCode) {
  if (!error || typeof error !== "object") {
    return fallbackCode;
  }

  if (error.code === "ENOENT") {
    return ERROR_CODES.FILE_NOT_FOUND;
  }

  if (error.code === "EACCES" || error.code === "EPERM") {
    return ERROR_CODES.FILE_ACCESS_DENIED;
  }

  return fallbackCode;
}

function mapFsErrorToMessage(code, requestedPath, fallbackMessage) {
  if (code === ERROR_CODES.FILE_NOT_FOUND) {
    return `Файл отсутствует: ${requestedPath}`;
  }

  if (code === ERROR_CODES.FILE_ACCESS_DENIED) {
    return `Нет доступа к файлу: ${requestedPath}`;
  }

  return fallbackMessage;
}

function buildFileResultBase(item) {
  const requestedPath = normalizeRequestedPath(item);
  const base = {
    requestedPath,
    status: "failed",
    providedPath: null,
    error: null,
  };

  if (item && typeof item === "object") {
    if (typeof item.kind === "string" && item.kind.trim()) {
      base.kind = item.kind.trim();
    }
    if (Array.isArray(item.lines)) {
      base.lines = [...item.lines];
    }
  }

  return base;
}

function buildProvidedResult(item, providedEntry) {
  const result = buildFileResultBase(item);
  result.status = "provided";
  result.providedPath = providedEntry.path;
  result.error = null;
  return result;
}

function buildMissingResult(item, error) {
  const result = buildFileResultBase(item);
  result.status = "missing";
  result.providedPath = null;
  result.error = error;
  return result;
}

function buildFailedResult(item, error) {
  const result = buildFileResultBase(item);
  result.status = "failed";
  result.providedPath = null;
  result.error = error;
  return result;
}

async function copyFileProvide({ item, projectRoot, providedDir }) {
  const requestedPath = normalizeRequestedPath(item);

  let resolved;
  try {
    resolved = assertRelativeProjectPath(projectRoot, item.path);
  } catch (error) {
    return {
      providedEntry: null,
      fileResult: buildFailedResult(
        item,
        makeFileError(ERROR_CODES.FILE_COPY_FAILED, error.message, {
          requestedPath,
        })
      ),
    };
  }

  const { normalized, absPath } = resolved;

  let stat;
  try {
    stat = await fsp.stat(absPath);
  } catch (error) {
    const code = mapFsErrorToCode(error, ERROR_CODES.FILE_READ_FAILED);
    const message = mapFsErrorToMessage(
      code,
      requestedPath,
      `Не удалось прочитать файл: ${requestedPath}`
    );

    if (code === ERROR_CODES.FILE_NOT_FOUND) {
      return {
        providedEntry: null,
        fileResult: buildMissingResult(item, makeFileError(code, message)),
      };
    }

    return {
      providedEntry: null,
      fileResult: buildFailedResult(item, makeFileError(code, message)),
    };
  }

  if (!stat.isFile()) {
    return {
      providedEntry: null,
      fileResult: buildFailedResult(
        item,
        makeFileError(
          ERROR_CODES.FILE_COPY_FAILED,
          `Путь не указывает на обычный файл: ${requestedPath}`
        )
      ),
    };
  }

  const targetAbs = path.join(providedDir, normalized);

  try {
    await ensureDir(path.dirname(targetAbs));
    await fsp.copyFile(absPath, targetAbs);
  } catch (error) {
    const code = mapFsErrorToCode(error, ERROR_CODES.FILE_COPY_FAILED);
    const message =
      code === ERROR_CODES.FILE_ACCESS_DENIED
        ? `Нет доступа при копировании файла: ${requestedPath}`
        : `Не удалось скопировать файл: ${requestedPath}`;

    return {
      providedEntry: null,
      fileResult: buildFailedResult(item, makeFileError(code, message)),
    };
  }

  const providedEntry = {
    kind: "file",
    path: `provided/${normalized}`,
  };

  return {
    providedEntry,
    fileResult: buildProvidedResult(item, providedEntry),
  };
}

async function copyFileFragmentProvide({ item, projectRoot, providedDir }) {
  const requestedPath = normalizeRequestedPath(item);

  let resolved;
  try {
    resolved = assertRelativeProjectPath(projectRoot, item.path);
  } catch (error) {
    return {
      providedEntry: null,
      fileResult: buildFailedResult(
        item,
        makeFileError(ERROR_CODES.FILE_COPY_FAILED, error.message, {
          requestedPath,
        })
      ),
    };
  }

  if (
    !Array.isArray(item.lines) ||
    item.lines.length !== 2 ||
    !Number.isInteger(item.lines[0]) ||
    !Number.isInteger(item.lines[1])
  ) {
    return {
      providedEntry: null,
      fileResult: buildFailedResult(
        item,
        makeFileError(
          ERROR_CODES.FILE_COPY_FAILED,
          `Диапазон lines должен иметь форму [start, end]: ${requestedPath}`
        )
      ),
    };
  }

  const [startLine, endLine] = item.lines;

  if (startLine < 1 || endLine < startLine) {
    return {
      providedEntry: null,
      fileResult: buildFailedResult(
        item,
        makeFileError(
          ERROR_CODES.FILE_COPY_FAILED,
          `Некорректный диапазон lines: ${requestedPath}`
        )
      ),
    };
  }

  const { normalized, absPath } = resolved;

  let raw;
  try {
    raw = await fsp.readFile(absPath, "utf8");
  } catch (error) {
    const code = mapFsErrorToCode(error, ERROR_CODES.FILE_READ_FAILED);
    const message = mapFsErrorToMessage(
      code,
      requestedPath,
      `Не удалось прочитать файл для фрагмента: ${requestedPath}`
    );

    if (code === ERROR_CODES.FILE_NOT_FOUND) {
      return {
        providedEntry: null,
        fileResult: buildMissingResult(item, makeFileError(code, message)),
      };
    }

    return {
      providedEntry: null,
      fileResult: buildFailedResult(item, makeFileError(code, message)),
    };
  }

  const lines = raw.split(/\r?\n/);
  const fragment = lines.slice(startLine - 1, endLine).join("\n");
  const fragmentsDir = path.join(providedDir, "fragments");
  const fragmentFileName = makeFragmentFileName(normalized, startLine, endLine);
  const fragmentAbs = path.join(fragmentsDir, fragmentFileName);

  try {
    await ensureDir(fragmentsDir);
    await fsp.writeFile(fragmentAbs, fragment, "utf8");
  } catch (error) {
    const code = mapFsErrorToCode(error, ERROR_CODES.FILE_COPY_FAILED);
    const message =
      code === ERROR_CODES.FILE_ACCESS_DENIED
        ? `Нет доступа при подготовке фрагмента: ${requestedPath}`
        : `Не удалось подготовить фрагмент файла: ${requestedPath}`;

    return {
      providedEntry: null,
      fileResult: buildFailedResult(item, makeFileError(code, message)),
    };
  }

  const providedEntry = {
    kind: "file_fragment",
    path: `provided/fragments/${fragmentFileName}`,
    source: normalized,
    lines: [startLine, endLine],
  };

  const fileResult = buildProvidedResult(item, providedEntry);
  fileResult.source = normalized;

  return {
    providedEntry,
    fileResult,
  };
}

async function collectProvideItem({ item, projectRoot, providedDir }) {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    return {
      providedEntry: null,
      fileResult: buildFailedResult(
        item,
        makeFileError(
          ERROR_CODES.FILE_COPY_FAILED,
          "Элемент provide должен быть объектом"
        )
      ),
    };
  }

  if (item.kind === "file") {
    return copyFileProvide({ item, projectRoot, providedDir });
  }

  if (item.kind === "file_fragment") {
    return copyFileFragmentProvide({ item, projectRoot, providedDir });
  }

  return {
    providedEntry: null,
    fileResult: buildFailedResult(
      item,
      makeFileError(
        ERROR_CODES.FILE_COPY_FAILED,
        `Неподдерживаемый provide kind: ${item.kind}`
      )
    ),
  };
}

function buildSummary(fileResults) {
  const summary = {
    requested: fileResults.length,
    provided: 0,
    missing: 0,
    failed: 0,
  };

  for (const item of fileResults) {
    if (item.status === "provided") {
      summary.provided += 1;
      continue;
    }

    if (item.status === "missing") {
      summary.missing += 1;
      continue;
    }

    summary.failed += 1;
  }

  return summary;
}

function buildFileDeliveryReport({ fileResults }) {
  const requestedFiles = fileResults.map((item) => item.requestedPath);
  const providedFiles = fileResults
    .filter((item) => item.status === "provided")
    .map((item) => item.requestedPath);
  const summary = buildSummary(fileResults);
  const ok = summary.missing === 0 && summary.failed === 0;

  return {
    ok,
    error: ok
      ? null
      : makeFileError(
          ERROR_CODES.REQUIRED_FILES_DELIVERY_FAILED,
          "Не удалось подготовить и передать полный набор обязательных файлов"
        ),
    summary,
    requestedFiles,
    providedFiles,
    fileResults,
    projectTree: {
      attached: false,
      path: null,
    },
  };
}

async function buildProjectTreeLines(rootDir, relDir = "", depth = 0, state = null) {
  const treeState =
    state || {
      lines: ["."],
      count: 0,
      truncated: false,
    };

  if (treeState.truncated) {
    return treeState;
  }

  const currentDir = relDir ? path.join(rootDir, relDir) : rootDir;
  const entries = await fsp.readdir(currentDir, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name, "en"));

  for (const entry of entries) {
    if (treeState.truncated) {
      break;
    }

    treeState.count += 1;
    if (treeState.count > DEFAULT_TREE_MAX_ENTRIES) {
      treeState.lines.push("... [tree truncated: too many entries]");
      treeState.truncated = true;
      break;
    }

    const relPath = relDir ? path.join(relDir, entry.name) : entry.name;
    const normalized = relPath.split(path.sep).join("/");
    const indent = "  ".repeat(depth + 1);

    if (entry.isDirectory()) {
      treeState.lines.push(`${indent}${entry.name}/`);

      if (depth + 1 >= DEFAULT_TREE_MAX_DEPTH) {
        treeState.lines.push(`${indent}  ... [depth limit reached]`);
        continue;
      }

      await buildProjectTreeLines(rootDir, normalized, depth + 1, treeState);
      continue;
    }

    treeState.lines.push(`${indent}${entry.name}`);
  }

  return treeState;
}

async function attachProjectTree({ projectRoot, providedDir }) {
  const targetAbs = path.join(providedDir, "project-tree.txt");
  const treeState = await buildProjectTreeLines(projectRoot);
  await fsp.writeFile(targetAbs, `${treeState.lines.join("\n")}\n`, "utf8");

  return {
    attached: true,
    path: PROJECT_TREE_REL_PATH,
  };
}

function buildInternalDeliveryFailureReport({ items, fileResults, error, projectTree }) {
  const requestedFiles = Array.isArray(items)
    ? items.map((item) => normalizeRequestedPath(item))
    : [];

  return {
    ok: false,
    error: makeFileError(
      ERROR_CODES.INTERNAL_DELIVERY_ERROR,
      "Внутренняя ошибка сборки отчёта доставки файлов",
      {
        message:
          error && typeof error.message === "string"
            ? error.message
            : "Unknown delivery error",
      }
    ),
    summary: {
      requested: requestedFiles.length,
      provided: fileResults.filter((item) => item.status === "provided").length,
      missing: fileResults.filter((item) => item.status === "missing").length,
      failed: fileResults.filter((item) => item.status === "failed").length,
    },
    requestedFiles,
    providedFiles: fileResults
      .filter((item) => item.status === "provided")
      .map((item) => item.requestedPath),
    fileResults,
    projectTree: projectTree || {
      attached: false,
      path: null,
    },
  };
}

async function collectProvideOutputs({
  provide,
  projectRoot,
  tmpRoot,
  runId,
  runtimePaths = null,
  tolerateErrors = false,
}) {
  const items = Array.isArray(provide) ? provide : [];

  if (items.length === 0) {
    return {
      provided: [],
      tmpProvidedDir: null,
      fileDeliveryReport: null,
    };
  }

  let tmpProvidedDir = null;
  let providedDir = null;
  const provided = [];
  const fileResults = [];

  try {
    if (runtimePaths && runtimePaths.runDir && runtimePaths.runProvidedDir) {
      tmpProvidedDir = runtimePaths.runDir;
      providedDir = runtimePaths.runProvidedDir;
    } else {
      const token = crypto.randomBytes(4).toString("hex");
      tmpProvidedDir = path.join(tmpRoot, `outbox-provided-${runId}-${token}`);
      providedDir = path.join(tmpProvidedDir, "provided");
    }

    await ensureDir(providedDir);

    for (const item of items) {
      const result = await collectProvideItem({
        item,
        projectRoot,
        providedDir,
      });

      fileResults.push(result.fileResult);

      if (result.providedEntry) {
        provided.push(result.providedEntry);
      }
    }

    const fileDeliveryReport = buildFileDeliveryReport({ fileResults });

    if (!fileDeliveryReport.ok) {
      fileDeliveryReport.projectTree = await attachProjectTree({
        projectRoot,
        providedDir,
      });
    }

    return {
      provided,
      tmpProvidedDir,
      fileDeliveryReport,
    };
  } catch (error) {
    if (!tolerateErrors) {
      throw error;
    }

    return {
      provided,
      tmpProvidedDir,
      fileDeliveryReport: buildInternalDeliveryFailureReport({
        items,
        fileResults,
        error,
      }),
    };
  }
}

module.exports = {
  PROJECT_TREE_REL_PATH,
  collectProvideOutputs,
};
