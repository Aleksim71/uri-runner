/* path: src/runtime/command-registry/match-command-registry-entry.cjs */
"use strict";

function normalizeString(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function normalizeArgs(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeString(item))
    .filter((item) => item.length > 0);
}

function matchesArgsExact(actual, expected) {
  if (!Array.isArray(expected) || expected.length === 0) {
    return true;
  }

  if (actual.length !== expected.length) {
    return false;
  }

  return expected.every((value, index) => actual[index] === value);
}

function matchesArgsPrefix(actual, prefix) {
  if (!Array.isArray(prefix) || prefix.length === 0) {
    return true;
  }

  if (actual.length < prefix.length) {
    return false;
  }

  return prefix.every((value, index) => actual[index] === value);
}

function matchesArgsContains(actual, values) {
  if (!Array.isArray(values) || values.length === 0) {
    return true;
  }

  return values.every((value) => actual.includes(value));
}

function matchesArgsContainsAny(actual, values) {
  if (!Array.isArray(values) || values.length === 0) {
    return true;
  }

  return values.some((value) => actual.includes(value));
}

function matchCommandRegistryEntry(entry, candidate) {
  const match = entry && entry.match && typeof entry.match === "object" ? entry.match : {};
  const cmd = normalizeString(candidate && candidate.cmd);
  const args = normalizeArgs(candidate && candidate.args);

  if (!cmd) {
    return false;
  }

  if (normalizeString(match.cmd) && normalizeString(match.cmd) !== cmd) {
    return false;
  }

  if (!matchesArgsExact(args, match.args_exact)) {
    return false;
  }

  if (!matchesArgsPrefix(args, match.args_prefix)) {
    return false;
  }

  if (!matchesArgsContains(args, match.args_contains)) {
    return false;
  }

  if (!matchesArgsContainsAny(args, match.args_contains_any)) {
    return false;
  }

  return true;
}

module.exports = {
  matchCommandRegistryEntry,
};
