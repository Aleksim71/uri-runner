/* path: src/runtime/command-registry/build-classification-request.cjs */
"use strict";

function normalizeCommandPreview(command) {
  const args = Array.isArray(command?.args) ? command.args : [];
  return [command?.cmd || "", ...args].filter(Boolean).join(" ").trim();
}

function buildClassificationRequest({
  runbook,
  registryPath,
  unknownCommands,
  generatedAt = null,
}) {
  return {
    version: 1,
    status: "classification_required",
    generated_at: generatedAt || new Date().toISOString(),
    profile: "audit",
    project:
      typeof runbook?.project === "string" && runbook.project.trim()
        ? runbook.project.trim()
        : null,
    registry_path: registryPath || null,
    unknown_commands: (Array.isArray(unknownCommands) ? unknownCommands : []).map((item) => ({
      source: item.source,
      kind: item.kind,
      name: item.name || null,
      cmd: item.cmd,
      args: Array.isArray(item.args) ? item.args : [],
      preview: normalizeCommandPreview(item),
      suggested_match: {
        cmd: item.cmd,
        args_prefix:
          Array.isArray(item.args) && item.args.length > 0
            ? [item.args[0]]
            : [],
      },
      readiness:
        item.readiness && typeof item.readiness === "object" ? item.readiness : undefined,
      base_url:
        typeof item.base_url === "string" && item.base_url.trim() ? item.base_url.trim() : undefined,
    })),
  };
}

module.exports = {
  buildClassificationRequest,
};
