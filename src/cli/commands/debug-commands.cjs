"use strict";

const path = require("path");

const { readRunbookFromInboxZip } = require("../../uram/runbook.cjs");
const { resolveProjectContext } = require("../../uram/project-resolver.cjs");
const { loadExecutableContext } = require("../../uram/executable-context.cjs");

function uniquePaths(paths) {
  return [...new Set(paths.filter(Boolean).map((p) => path.resolve(p)))];
}

function getSystemCommandDirs(projectRoot) {
  return uniquePaths([
    path.join(projectRoot, "contexts", "system", "commands"),
    path.join(__dirname, "..", "..", "uram", "commands", "system"),
    path.join(__dirname, "..", "..", "commands", "system"),
    path.join(__dirname, "..", "..", "cli", "commands"),
    path.join(process.cwd(), "src", "uram", "commands", "system"),
    path.join(process.cwd(), "src", "commands", "system"),
    path.join(process.cwd(), "src", "cli", "commands"),
  ]);
}

function getProjectCommandDirs(projectRoot) {
  return uniquePaths([
    path.join(projectRoot, "contexts", "project", "commands"),
  ]);
}

async function scanCommandDir(dirPath, namespace) {
  const fs = require("fs/promises");

  let entries = [];
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }

  const commands = [];

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    if (!entry.name.endsWith(".cjs")) {
      continue;
    }

    const absolutePath = path.join(dirPath, entry.name);
    const commandBaseName = entry.name.replace(/\.cjs$/, "");
    const commandName = `${namespace}.${commandBaseName}`;

    commands.push({
      command: commandName,
      namespace,
      path: absolutePath,
    });
  }

  return commands.sort((a, b) => a.command.localeCompare(b.command));
}

async function collectCommands({ projectRoot, executableCtx }) {
  const roots =
    executableCtx &&
    executableCtx.commands &&
    Array.isArray(executableCtx.commands.roots)
      ? executableCtx.commands.roots
      : [];

  const all = [];

  for (const root of roots) {
    if (root === "system") {
      for (const dirPath of getSystemCommandDirs(projectRoot)) {
        const items = await scanCommandDir(dirPath, "system");
        for (const item of items) {
          all.push(item);
        }
      }
      continue;
    }

    if (root === "project") {
      for (const dirPath of getProjectCommandDirs(projectRoot)) {
        const items = await scanCommandDir(dirPath, "project");
        for (const item of items) {
          all.push(item);
        }
      }
    }
  }

  const deduped = new Map();

  for (const item of all) {
    if (!deduped.has(item.command)) {
      deduped.set(item.command, item);
    }
  }

  return Array.from(deduped.values()).sort((a, b) =>
    a.command.localeCompare(b.command)
  );
}

function formatCommandsReport({ project, executableCtx, commands }) {
  const roots =
    executableCtx &&
    executableCtx.commands &&
    Array.isArray(executableCtx.commands.roots)
      ? executableCtx.commands.roots
      : [];

  const strictCommands =
    executableCtx &&
    executableCtx.runtime &&
    executableCtx.runtime.strict_commands === true;

  const maxSteps =
    executableCtx &&
    executableCtx.runtime &&
    Number.isFinite(executableCtx.runtime.max_steps)
      ? executableCtx.runtime.max_steps
      : null;

  const lines = [];

  lines.push("COMMANDS");
  lines.push("────────");
  lines.push(`project: ${project}`);
  lines.push(`count: ${commands.length}`);
  lines.push(`roots: ${roots.length > 0 ? roots.join(", ") : "(empty)"}`);
  lines.push(`strictCommands: ${strictCommands ? "true" : "false"}`);
  lines.push(`maxSteps: ${maxSteps === null ? "null" : maxSteps}`);
  lines.push("");

  if (commands.length === 0) {
    lines.push("(no commands found)");
    return lines.join("\n");
  }

  for (const item of commands) {
    lines.push(`${item.command}`);
    lines.push(`  path: ${item.path}`);
  }

  return lines.join("\n");
}

async function debugCommands({ uramRoot, inboxZipPath }) {
  const { runbook } = await readRunbookFromInboxZip(inboxZipPath);

  const project = runbook?.project;
  if (!project) {
    throw new Error("[uri] runbook missing project field");
  }

  const projectCtx = await resolveProjectContext({
    uramRoot,
    project,
  });

  const executableCtx = await loadExecutableContext(projectCtx);

  const commands = await collectCommands({
    projectRoot: projectCtx.cwd,
    executableCtx,
  });

  const report = formatCommandsReport({
    project,
    executableCtx,
    commands,
  });

  console.log(report);
}

module.exports = {
  getSystemCommandDirs,
  getProjectCommandDirs,
  scanCommandDir,
  collectCommands,
  formatCommandsReport,
  debugCommands,
};
