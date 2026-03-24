"use strict";

function serializeError(error) {
  if (!error) {
    return null;
  }

  return {
    name: typeof error.name === "string" && error.name.trim()
      ? error.name
      : "Error",
    message: typeof error.message === "string" && error.message.trim()
      ? error.message
      : String(error),
    code: typeof error.code === "string" && error.code.trim()
      ? error.code
      : null,
    stack: typeof error.stack === "string" && error.stack.trim()
      ? error.stack
      : null,
  };
}

function nowIso() {
  return new Date().toISOString();
}

function toDurationMs(startedAt, finishedAt) {
  const start = new Date(startedAt).getTime();
  const end = new Date(finishedAt).getTime();

  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return 0;
  }

  return Math.max(0, end - start);
}

module.exports = {
  serializeError,
  nowIso,
  toDurationMs,
};
