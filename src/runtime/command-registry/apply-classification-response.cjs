/* path: src/runtime/command-registry/apply-classification-response.cjs */
"use strict";

const fs = require("fs-extra");
const path = require("path");
const YAML = require("yaml");

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeMatch(match) {
  if (!isObject(match) || typeof match.cmd !== "string" || !match.cmd.trim()) {
    return null;
  }

  const result = {
    cmd: match.cmd.trim(),
  };

  for (const key of ["args_exact", "args_prefix", "args_contains", "args_contains_any"]) {
    if (Array.isArray(match[key]) && match[key].length > 0) {
      result[key] = match[key].map((item) => String(item));
    }
  }

  return result;
}

function normalizeCommandEntry(entry, index) {
  if (!isObject(entry)) {
    return null;
  }

  const match = normalizeMatch(entry.match);
  if (!match) {
    return null;
  }

  return {
    id:
      typeof entry.id === "string" && entry.id.trim()
        ? entry.id.trim()
        : `classified.command.${index + 1}`,
    group:
      typeof entry.group === "string" && entry.group.trim()
        ? entry.group.trim()
        : "classified",
    profile:
      typeof entry.profile === "string" && entry.profile.trim()
        ? entry.profile.trim()
        : "instant",
    notes:
      typeof entry.notes === "string" && entry.notes.trim()
        ? entry.notes.trim()
        : "Added via classification response",
    match,
    ...(isObject(entry.readiness) ? { readiness: entry.readiness } : {}),
  };
}

function matchFingerprint(match) {
  return JSON.stringify(match || {});
}

function createRegistrySkeleton() {
  return {
    version: 1,
    defaults: {
      on_unknown: "classification_required",
      generate_request: true,
      execute_unknown: false,
    },
    profiles: {},
    commands: [],
  };
}

function normalizeResponse(response) {
  if (!isObject(response)) {
    const err = new Error("classification response must be an object");
    err.code = "CLASSIFICATION_RESPONSE_INVALID";
    throw err;
  }

  if (response.version !== 1) {
    const err = new Error("classification response: version must be 1");
    err.code = "CLASSIFICATION_RESPONSE_INVALID";
    throw err;
  }

  const sourceEntries = Array.isArray(response.commands)
    ? response.commands
    : Array.isArray(response.classifications)
      ? response.classifications
      : [];

  const commands = sourceEntries
    .map((entry, index) => normalizeCommandEntry(entry, index))
    .filter(Boolean);

  if (commands.length === 0) {
    const err = new Error("classification response must provide at least one valid command entry");
    err.code = "CLASSIFICATION_RESPONSE_INVALID";
    throw err;
  }

  return {
    commands,
  };
}

async function loadRegistry(registryPath) {
  if (!(await fs.pathExists(registryPath))) {
    return createRegistrySkeleton();
  }

  const raw = await fs.readFile(registryPath, "utf8");
  const parsed = YAML.parse(raw);

  if (!isObject(parsed)) {
    return createRegistrySkeleton();
  }

  return {
    version: parsed.version === 1 ? 1 : 1,
    defaults: isObject(parsed.defaults) ? parsed.defaults : createRegistrySkeleton().defaults,
    profiles: isObject(parsed.profiles) ? parsed.profiles : {},
    commands: Array.isArray(parsed.commands) ? parsed.commands.slice() : [],
  };
}

async function applyClassificationResponse({
  registryPath,
  response,
  sourcePath = null,
  reportDir = null,
}) {
  if (typeof registryPath !== "string" || !registryPath.trim()) {
    const err = new Error("registryPath is required");
    err.code = "CLASSIFICATION_RESPONSE_APPLY_FAILED";
    throw err;
  }

  const normalizedResponse = normalizeResponse(response);
  const registry = await loadRegistry(registryPath);

  const existingCommands = Array.isArray(registry.commands) ? registry.commands.slice() : [];
  const byId = new Map();
  const byMatch = new Map();

  existingCommands.forEach((entry, index) => {
    if (isObject(entry) && typeof entry.id === "string" && entry.id.trim()) {
      byId.set(entry.id.trim(), index);
    }

    const normalizedMatch = normalizeMatch(entry?.match);
    if (normalizedMatch) {
      byMatch.set(matchFingerprint(normalizedMatch), index);
    }
  });

  let added = 0;
  let replaced = 0;
  let skipped = 0;

  for (const entry of normalizedResponse.commands) {
    const fp = matchFingerprint(entry.match);

    if (byId.has(entry.id)) {
      const targetIndex = byId.get(entry.id);
      existingCommands[targetIndex] = entry;
      byMatch.set(fp, targetIndex);
      replaced += 1;
      continue;
    }

    if (byMatch.has(fp)) {
      const targetIndex = byMatch.get(fp);
      existingCommands[targetIndex] = entry;
      byId.set(entry.id, targetIndex);
      replaced += 1;
      continue;
    }

    existingCommands.push(entry);
    const targetIndex = existingCommands.length - 1;
    byId.set(entry.id, targetIndex);
    byMatch.set(fp, targetIndex);
    added += 1;
  }

  registry.commands = existingCommands;

  await fs.ensureDir(path.dirname(registryPath));
  await fs.writeFile(registryPath, YAML.stringify(registry), "utf8");

  const report = {
    ok: true,
    applied_at: new Date().toISOString(),
    registryPath,
    sourcePath,
    added,
    replaced,
    skipped,
    total_commands: registry.commands.length,
    applied_commands: normalizedResponse.commands.map((entry) => ({
      id: entry.id,
      group: entry.group,
      profile: entry.profile,
      match: entry.match,
    })),
  };

  if (typeof reportDir === "string" && reportDir.trim()) {
    const reportYamlPath = path.join(reportDir, "classification-response.apply.yaml");
    const reportJsonPath = path.join(reportDir, "classification-response.apply.json");

    await fs.ensureDir(reportDir);
    await fs.writeFile(reportYamlPath, YAML.stringify(report), "utf8");
    await fs.writeJson(reportJsonPath, report, { spaces: 2 });

    report.reportYamlPath = reportYamlPath;
    report.reportJsonPath = reportJsonPath;
  }

  return report;
}

module.exports = {
  applyClassificationResponse,
};
