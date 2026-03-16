"use strict";

const fs = require("fs/promises");
const path = require("path");
const YAML = require("yaml");

async function readYamlIfExists(filePath) {
  try {
    const txt = await fs.readFile(filePath, "utf8");
    return YAML.parse(txt);
  } catch {
    return null;
  }
}

async function loadProjectsConfig(uramRoot) {
  const primaryPath = path.join(uramRoot, "config", "projects.yaml");
  const fallbackPath = path.join(uramRoot, "config", "projects.yaml.example");

  const doc =
    (await readYamlIfExists(primaryPath)) ||
    (await readYamlIfExists(fallbackPath));

  if (!doc) {
    throw new Error(`[uri] projects config not found: ${primaryPath}`);
  }

  if (doc.version !== 1) {
    throw new Error("[uri] projects config: version must be 1");
  }

  if (!doc.projects || typeof doc.projects !== "object") {
    throw new Error("[uri] projects config: projects section missing");
  }

  return doc.projects;
}

async function resolveProjectContext({ uramRoot, project }) {
  if (!uramRoot || typeof uramRoot !== "string") {
    throw new Error("[uri] resolveProjectContext: uramRoot is required");
  }

  if (!project || typeof project !== "string") {
    throw new Error("[uri] resolveProjectContext: project is required");
  }

  const projects = await loadProjectsConfig(uramRoot);
  const entry = projects[project];

  if (!entry) {
    if (project === "demo") {
      return {
        project,
        cwd: uramRoot,
      };
    }
    throw new Error(`[uri] project not registered: ${project}`);
  }

  if (!entry.cwd || typeof entry.cwd !== "string") {
    throw new Error(`[uri] project ${project} has no cwd`);
  }

  const cwd = path.isAbsolute(entry.cwd)
    ? entry.cwd
    : path.resolve(uramRoot, entry.cwd);

  return {
    project,
    cwd,
  };
}

module.exports = {
  resolveProjectContext,
};
