"use strict";

function normalizeArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  return [String(value).trim()].filter(Boolean);
}

function getCommandRoot(name) {
  if (!name || typeof name !== "string") return "";
  const trimmed = name.trim();
  const dotIndex = trimmed.indexOf(".");
  return dotIndex === -1 ? trimmed : trimmed.slice(0, dotIndex);
}

class CommandRegistry {
  constructor() {
    this.handlers = new Map();
  }

  register(name, handler) {
    if (!name || typeof name !== "string") {
      throw new Error("CommandRegistry.register: name must be a non-empty string");
    }

    if (typeof handler !== "function") {
      throw new Error(`CommandRegistry.register: handler for "${name}" must be a function`);
    }

    if (this.handlers.has(name)) {
      throw new Error(`CommandRegistry.register: command "${name}" is already registered`);
    }

    this.handlers.set(name, handler);
  }

  has(name) {
    return this.handlers.has(name);
  }

  list() {
    return Array.from(this.handlers.keys());
  }

  isAllowed(name, executableCtx = {}) {
    const strictCommands = executableCtx?.runtime?.strictCommands === true;

    const allowedRoots = normalizeArray(executableCtx?.commands?.roots);
    const whitelist = normalizeArray(executableCtx?.commands?.whitelist);
    const blacklist = normalizeArray(executableCtx?.commands?.blacklist);

    const exists = this.has(name);

    if (!exists) {
      if (strictCommands) {
        return {
          ok: false,
          code: "COMMAND_NOT_REGISTERED",
          message: `unknown command "${name}"`,
        };
      }

      return {
        ok: true,
        code: null,
        message: null,
      };
    }

    const root = getCommandRoot(name);

    if (allowedRoots.length > 0 && !allowedRoots.includes(root)) {
      return {
        ok: false,
        code: "COMMAND_ROOT_NOT_ALLOWED",
        message: `command root "${root}" is not allowed for "${name}"`,
      };
    }

    if (blacklist.length > 0 && blacklist.includes(name)) {
      return {
        ok: false,
        code: "COMMAND_BLOCKED",
        message: `command "${name}" is blocked by blacklist`,
      };
    }

    if (whitelist.length > 0 && !whitelist.includes(name)) {
      return {
        ok: false,
        code: "COMMAND_NOT_ALLOWED",
        message: `command "${name}" is not allowed by whitelist`,
      };
    }

    return {
      ok: true,
      code: null,
      message: null,
    };
  }

  assertAllowed(name, executableCtx = {}) {
    const check = this.isAllowed(name, executableCtx);

    if (!check.ok) {
      const error = new Error(`CommandRegistry.assertAllowed: ${check.message}`);
      error.code = check.code;
      throw error;
    }

    return true;
  }

  resolve(name, executableCtx = null) {
    if (executableCtx) {
      this.assertAllowed(name, executableCtx);
    } else if (!this.handlers.has(name)) {
      throw new Error(`CommandRegistry.resolve: unknown command "${name}"`);
    }

    return this.handlers.get(name);
  }
}

module.exports = { CommandRegistry };
