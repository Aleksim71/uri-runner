// path: src/runtime/browser/execute-browser-session-start-step.cjs
"use strict";

function resolveStartBrowserSession(mod) {
  if (typeof mod === "function") {
    return mod;
  }

  if (mod && typeof mod.startBrowserSession === "function") {
    return mod.startBrowserSession;
  }

  if (mod && typeof mod.run === "function") {
    return mod.run;
  }

  if (mod && typeof mod.default === "function") {
    return mod.default;
  }

  return null;
}

function buildFallbackEnvironment(params = {}) {
  const input = params.input && typeof params.input === "object" ? params.input : {};
  const runtimeContext =
    params.runtimeContext && typeof params.runtimeContext === "object"
      ? params.runtimeContext
      : {};

  const firstPageOpenStep =
    runtimeContext.plan &&
    Array.isArray(runtimeContext.plan.steps)
      ? runtimeContext.plan.steps.find(
          (step) =>
            step &&
            step.command === "browser.page.open" &&
            step.args &&
            typeof step.args === "object"
        )
      : null;

  const baseUrl =
    (typeof input.baseUrl === "string" && input.baseUrl.trim()) ||
    (typeof input.url === "string" && input.url.trim()) ||
    (firstPageOpenStep &&
    firstPageOpenStep.args &&
    typeof firstPageOpenStep.args.url === "string" &&
    firstPageOpenStep.args.url.trim()
      ? firstPageOpenStep.args.url.trim()
      : null) ||
    null;

  const endpoint =
    (typeof input.endpoint === "string" && input.endpoint.trim()) || null;

  return {
    target: "browser",
    kind: "scenario",
    source: "compiled-plan",
    baseUrl,
    endpoint,
  };
}

function resolveSessionId(params = {}) {
  if (typeof params.sessionId === "string" && params.sessionId.trim().length > 0) {
    return params.sessionId.trim();
  }

  const input = params.input && typeof params.input === "object" ? params.input : {};

  if (typeof input.sessionId === "string" && input.sessionId.trim().length > 0) {
    return input.sessionId.trim();
  }

  return null;
}

async function executeBrowserSessionStartStep(params = {}) {
  const mod = require("./start-browser-session.cjs");
  const startBrowserSession = resolveStartBrowserSession(mod);

  if (typeof startBrowserSession !== "function") {
    const error = new Error(
      "start-browser-session.cjs does not export a callable start function"
    );
    error.code = "BROWSER_START_EXPORT_MISSING";
    throw error;
  }

  const runtimeContext =
    params.runtimeContext && typeof params.runtimeContext === "object"
      ? params.runtimeContext
      : null;

  const input = params.input && typeof params.input === "object" ? params.input : {};

  const environment =
    params.environment && typeof params.environment === "object"
      ? params.environment
      : buildFallbackEnvironment({
          runtimeContext,
          input,
        });

  return startBrowserSession({
    runtimeContext,
    input,
    environment,
    sessionId: resolveSessionId(params),
  });
}

module.exports = {
  executeBrowserSessionStartStep,
};
