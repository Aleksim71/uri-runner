"use strict";

const { spawnSync } = require("node:child_process");

function readMetaFromZip(zipPath) {
  const r = spawnSync("unzip", ["-p", zipPath, "META.json"], { encoding: "utf8" });
  if (r.status !== 0) {
    return { ok: false, code: "META_MISSING", message: "META.json missing in zip", meta: null };
  }
  try {
    const meta = JSON.parse(r.stdout);
    return { ok: true, meta };
  } catch {
    return { ok: false, code: "META_INVALID_JSON", message: "META.json is not valid JSON", meta: null };
  }
}

function validateMeta(meta) {
  const missing = [];
  for (const k of ["version", "kind", "project", "profile", "created_at"]) {
    if (meta?.[k] === undefined || meta?.[k] === null || meta?.[k] === "") missing.push(k);
  }

  if (missing.length) {
    return {
      ok: false,
      code: "META_PROTOCOL_ERROR",
      message: `META missing fields: ${missing.join(", ")}`,
      missing,
    };
  }

  if (meta.version !== 1) {
    return { ok: false, code: "META_PROTOCOL_ERROR", message: "META.version must be 1", missing: [] };
  }

  if (meta.kind !== "info" && meta.kind !== "patch") {
    return { ok: false, code: "META_PROTOCOL_ERROR", message: "META.kind must be 'info' or 'patch'", missing: [] };
  }

  return { ok: true };
}

module.exports = { readMetaFromZip, validateMeta };
