/* path: src/runtime/command-registry/preflight-audit-runbook.cjs */
"use strict";

const { loadCommandRegistry } = require("./load-command-registry.cjs");
const { matchCommandRegistryEntry } = require("./match-command-registry-entry.cjs");
const { collectAuditCommandCandidates } = require("./collect-audit-command-candidates.cjs");
const { buildClassificationRequest } = require("./build-classification-request.cjs");

function preflightAuditRunbook({ runbook, registryPath, generatedAt = null } = {}) {
  const loaded = loadCommandRegistry({ registryPath });

  if (!loaded.ok) {
    return {
      ok: true,
      status: "registry_unavailable",
      registryPath: loaded.registryPath,
      registryError: loaded.error,
      matchedCommands: [],
      unknownCommands: [],
      classificationRequest: null,
    };
  }

  const registry = loaded.registry;
  const candidates = collectAuditCommandCandidates(runbook);
  const matchedCommands = [];
  const unknownCommands = [];

  for (const candidate of candidates) {
    const matchedEntry = registry.commands.find((entry) =>
      matchCommandRegistryEntry(entry, candidate)
    );

    if (matchedEntry) {
      matchedCommands.push({
        ...candidate,
        registryEntry: {
          id: matchedEntry.id,
          group: matchedEntry.group,
          profile: matchedEntry.profile,
        },
      });
      continue;
    }

    unknownCommands.push(candidate);
  }

  const classificationRequired =
    unknownCommands.length > 0 &&
    registry.defaults.on_unknown === "classification_required" &&
    registry.defaults.execute_unknown !== true;

  return {
    ok: !classificationRequired,
    status: classificationRequired ? "classification_required" : "ok",
    registryPath: loaded.registryPath,
    registry,
    matchedCommands,
    unknownCommands,
    classificationRequest: classificationRequired
      ? buildClassificationRequest({
          runbook,
          registryPath: loaded.registryPath,
          unknownCommands,
          generatedAt,
        })
      : null,
  };
}

module.exports = {
  preflightAuditRunbook,
};
