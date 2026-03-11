"use strict";

const fs = require("fs");
const path = require("path");

function isDirectory(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function isCommandFile(fileName) {
  return (
    fileName.endsWith(".cjs") &&
    fileName !== "command-registry.cjs" &&
    fileName !== "load-commands.cjs"
  );
}

function toCommandName(libraryName, fileName) {
  return `${libraryName}.${fileName.replace(/\.cjs$/, "")}`;
}

function resolveHandler(commandName, mod) {
  if (typeof mod === "function") {
    return mod;
  }

  if (mod && typeof mod === "object") {
    const functionEntries = Object.entries(mod).filter(([, value]) => typeof value === "function");

    if (functionEntries.length === 1) {
      return functionEntries[0][1];
    }
  }

  throw new Error(
    `loadCommands: command "${commandName}" does not export a single callable handler`
  );
}

function normalizeOnly(only) {
  if (!only) return null;

  const values = Array.isArray(only) ? only : [only];
  const filtered = values
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  return filtered.length > 0 ? new Set(filtered) : null;
}

function loadCommands(commandsDir, registry, options = {}) {
  if (!commandsDir || typeof commandsDir !== "string") {
    throw new Error("loadCommands: commandsDir must be a non-empty string");
  }

  if (!registry || typeof registry.register !== "function") {
    throw new Error("loadCommands: registry with register(name, handler) is required");
  }

  const only = normalizeOnly(options.only);
  const loaded = [];
  const libraries = fs.readdirSync(commandsDir).sort();

  for (const libraryName of libraries) {
    const libraryDir = path.join(commandsDir, libraryName);

    if (!isDirectory(libraryDir)) {
      continue;
    }

    const files = fs.readdirSync(libraryDir).sort();

    for (const fileName of files) {
      if (!isCommandFile(fileName)) {
        continue;
      }

      const commandName = toCommandName(libraryName, fileName);

      if (only && !only.has(commandName)) {
        continue;
      }

      const commandPath = path.join(libraryDir, fileName);

      // eslint-disable-next-line global-require, import/no-dynamic-require
      const mod = require(commandPath);
      const handler = resolveHandler(commandName, mod);

      registry.register(commandName, handler);

      loaded.push({
        name: commandName,
        path: commandPath,
      });
    }
  }

  if (only) {
    for (const commandName of only) {
      const exists = loaded.some((item) => item.name === commandName);
      if (!exists) {
        throw new Error(`loadCommands: command not found: ${commandName}`);
      }
    }
  }

  return loaded;
}

module.exports = {
  loadCommands,
};
