/* path: src/runtime/scenario-command-registry/apply-scenario-classification-response.cjs */
"use strict";

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => String(item || "").trim())
    .filter(Boolean);
}

function normalizeMatch(value) {
  if (!value || typeof value !== "object") {
    return {};
  }

  const match = {};

  if (typeof value.command === "string" && value.command.trim().length > 0) {
    match.command = value.command.trim();
  }

  if (typeof value.action === "string" && value.action.trim().length > 0) {
    match.action = value.action.trim();
  }

  return match;
}

function normalizeRegistryEntry(entry) {
  const source = entry && typeof entry === "object" ? entry : {};
  const match = normalizeMatch(source.match);

  return {
    id:
      typeof source.id === "string" && source.id.trim().length > 0
        ? source.id.trim()
        : match.command || match.action || null,
    group:
      typeof source.group === "string" && source.group.trim().length > 0
        ? source.group.trim()
        : null,
    profile:
      typeof source.profile === "string" && source.profile.trim().length > 0
        ? source.profile.trim()
        : null,
    notes:
      typeof source.notes === "string" && source.notes.trim().length > 0
        ? source.notes.trim()
        : null,
    match,
    argsSchema: {
      required: normalizeStringArray(source.args_schema && source.args_schema.required),
      optional: normalizeStringArray(source.args_schema && source.args_schema.optional),
    },
  };
}

function cloneRegistry(registry) {
  return {
    registryPath: registry && registry.registryPath ? registry.registryPath : null,
    version: registry && Number.isInteger(registry.version) ? registry.version : 1,
    defaults: registry && registry.defaults && typeof registry.defaults === "object" ? { ...registry.defaults } : {},
    namedCommands: Array.isArray(registry && registry.namedCommands)
      ? registry.namedCommands.map((item) => ({
          ...item,
          match: item && item.match ? { ...item.match } : {},
          argsSchema: item && item.argsSchema ? {
            required: [...(item.argsSchema.required || [])],
            optional: [...(item.argsSchema.optional || [])],
          } : { required: [], optional: [] },
        }))
      : [],
    browserActions: Array.isArray(registry && registry.browserActions)
      ? registry.browserActions.map((item) => ({
          ...item,
          match: item && item.match ? { ...item.match } : {},
          argsSchema: item && item.argsSchema ? {
            required: [...(item.argsSchema.required || [])],
            optional: [...(item.argsSchema.optional || [])],
          } : { required: [], optional: [] },
        }))
      : [],
  };
}

function upsertByMatch(list, entry) {
  const match = entry && entry.match ? entry.match : {};
  const key = match.command || match.action || null;

  if (!key) {
    return { updated: false, added: false };
  }

  const index = list.findIndex((item) => {
    const itemKey = item && item.match ? item.match.command || item.match.action || null : null;
    return itemKey === key;
  });

  if (index === -1) {
    list.push(entry);
    return { updated: false, added: true };
  }

  list[index] = entry;
  return { updated: true, added: false };
}

function getClassifications(response) {
  if (Array.isArray(response && response.classifications)) {
    return response.classifications;
  }

  return [];
}

function applyScenarioClassificationResponse({ registry, response } = {}) {
  if (!registry || typeof registry !== "object") {
    throw new Error("applyScenarioClassificationResponse: registry is required");
  }

  if (!response || typeof response !== "object") {
    return {
      registry: cloneRegistry(registry),
      report: {
        ok: true,
        added: 0,
        updated: 0,
        processed: 0,
      },
    };
  }

  const nextRegistry = cloneRegistry(registry);
  let added = 0;
  let updated = 0;

  for (const rawEntry of getClassifications(response)) {
    const entry = normalizeRegistryEntry(rawEntry);

    if (entry.match.command) {
      const result = upsertByMatch(nextRegistry.namedCommands, entry);
      if (result.added) added += 1;
      if (result.updated) updated += 1;
      continue;
    }

    if (entry.match.action) {
      const result = upsertByMatch(nextRegistry.browserActions, entry);
      if (result.added) added += 1;
      if (result.updated) updated += 1;
    }
  }

  return {
    registry: nextRegistry,
    report: {
      ok: true,
      added,
      updated,
      processed: added + updated,
    },
  };
}

module.exports = {
  applyScenarioClassificationResponse,
};
