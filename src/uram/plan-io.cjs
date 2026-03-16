"use strict";

const fsp = require("fs/promises");
const path = require("path");

const { assertPlanShape } = require("./plan-schema.cjs");

async function ensureDir(dirPath) {
  await fsp.mkdir(dirPath, { recursive: true });
}

async function writePlanToFile(plan, filePath) {
  const normalized = assertPlanShape(plan);

  const dir = path.dirname(filePath);
  await ensureDir(dir);

  const body = JSON.stringify(normalized, null, 2);

  await fsp.writeFile(filePath, body, "utf8");

  return {
    ok: true,
    path: filePath,
    bytes: Buffer.byteLength(body, "utf8"),
  };
}

async function readPlanFromFile(filePath) {
  const raw = await fsp.readFile(filePath, "utf8");

  let parsed;

  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const e = new Error("[uri] invalid PLAN file (JSON parse failed)");
    e.code = "PLAN_INVALID_JSON";
    e.details = { filePath };
    throw e;
  }

  const normalized = assertPlanShape(parsed);

  return normalized;
}

async function writePlanArtifact({
  plan,
  artifactsDir,
  runtimePaths,
  runId,
}) {
  const resolvedArtifactsDir =
    artifactsDir ||
    (runtimePaths && runtimePaths.runArtifactsDir) ||
    null;

  if (!resolvedArtifactsDir) {
    throw new Error("[uri] artifactsDir is required");
  }

  if (!runId) {
    throw new Error("[uri] runId is required");
  }

  const fileName = `${runId}.plan.json`;
  const filePath = path.join(resolvedArtifactsDir, fileName);

  const result = await writePlanToFile(plan, filePath);

  return {
    ok: true,
    filePath,
    bytes: result.bytes,
  };
}

async function readPlanArtifact(filePath) {
  return readPlanFromFile(filePath);
}

module.exports = {
  writePlanToFile,
  readPlanFromFile,
  writePlanArtifact,
  readPlanArtifact,
};
