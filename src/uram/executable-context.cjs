"use strict";

const fs = require("fs/promises");
const path = require("path");
const YAML = require("yaml");

function getExecutableContextPath(projectRoot) {
  if (!projectRoot) {
    throw new Error("[uri] projectRoot required");
  }

  return path.join(projectRoot, "contexts", "system", "executable.yaml");
}

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

async function writeExecutableContext({ projectRoot, doc }) {
  const filePath = getExecutableContextPath(projectRoot);

  await ensureDir(path.dirname(filePath));

  const yamlText = YAML.stringify(doc);

  await fs.writeFile(filePath, yamlText, "utf-8");

  return filePath;
}

async function readExecutableContext(projectRoot) {
  const filePath = getExecutableContextPath(projectRoot);

  let text;

  try {
    text = await fs.readFile(filePath, "utf-8");
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(`[uri] executable context not found: ${filePath}`);
    }
    throw error;
  }

  const doc = YAML.parse(text);

  if (!doc || typeof doc !== "object") {
    throw new Error("[uri] executable context invalid");
  }

  return {
    filePath,
    doc
  };
}

async function clearExecutableContext({ projectRoot, runId, ok, engine }) {
  const filePath = getExecutableContextPath(projectRoot);

  const clearedDoc = {
    version: 1,
    meta: {
      context_kind: "executable_context",
      context_id: "system_executable",
      status: "executed",
      last_run_id: runId || null,
      last_run_ok: ok === true,
      last_engine: engine || null
    }
  };

  await ensureDir(path.dirname(filePath));

  const yamlText = YAML.stringify(clearedDoc);

  await fs.writeFile(filePath, yamlText, "utf-8");

  return filePath;
}

module.exports = {
  getExecutableContextPath,
  writeExecutableContext,
  readExecutableContext,
  clearExecutableContext
};
