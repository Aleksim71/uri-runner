"use strict";

const fs = require("fs/promises");
const path = require("path");
const YAML = require("yaml");

async function loadProjectsConfig(uramRoot) {
  const cfgPath = path.join(uramRoot, "config", "projects.yaml");

  let txt;
  try {
    txt = await fs.readFile(cfgPath, "utf8");
  } catch {
    throw new Error(`[uri] projects.yaml not found: ${cfgPath}`);
  }

  const doc = YAML.parse(txt);

  if (!doc || doc.version !== 1) {
    throw new Error("[uri] projects.yaml: version must be 1");
  }

  if (!doc.projects || typeof doc.projects !== "object") {
    throw new Error("[uri] projects.yaml: projects section missing");
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
    throw new Error(`[uri] project not registered: ${project}`);
  }

  if (!entry.cwd || typeof entry.cwd !== "string") {
    throw new Error(`[uri] project ${project} has no cwd`);
  }

  return {
    project,
    cwd: path.resolve(entry.cwd),
  };
}

module.exports = {
  resolveProjectContext,
};
