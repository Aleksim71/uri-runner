"use strict";

const {
  createBrowserSessionState,
  updateBrowserSessionState,
} = require("../../runtime/browser/browser-session-store.cjs");
const {
  executeBrowserSessionStartStep,
} = require("../../runtime/browser/execute-browser-session-start-step.cjs");
const {
  executeBrowserPageOpenStep,
} = require("../../runtime/browser/execute-browser-page-open-step.cjs");
const {
  executeBrowserPageWaitStep,
} = require("../../runtime/browser/execute-browser-page-wait-step.cjs");
const {
  executeBrowserSessionStopStep,
} = require("../../runtime/browser/execute-browser-session-stop-step.cjs");

const SUPPORTED_STEPS = new Set([
  "browser.session.start",
  "browser.page.open",
  "browser.page.wait",
  "browser.session.stop",
]);

function parseJsonInput(value) {
  if (value === undefined || value === null || value === "") {
    return {};
  }

  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("debug step input must be a JSON object");
    }
    return parsed;
  } catch (error) {
    throw new Error(
      `debug step --input must be valid JSON object: ${error.message}`
    );
  }
}

function parseDebugStepArgs(args = []) {
  if (!Array.isArray(args) || args.length === 0) {
    throw new Error("debug step requires <step-type>");
  }

  const stepType = args[0];
  const rest = args.slice(1);

  if (!SUPPORTED_STEPS.has(stepType)) {
    throw new Error(`Unsupported debug step: ${stepType}`);
  }

  const options = {
    stepType,
    input: {},
  };

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];

    if (arg === "--input") {
      index += 1;
      if (index >= rest.length) {
        throw new Error("debug step option --input requires <json>");
      }
      options.input = parseJsonInput(rest[index]);
      continue;
    }

    throw new Error(`Unknown debug step option: ${arg}`);
  }

  return options;
}

function createFakePage(input = {}) {
  let currentUrl = null;
  const pageTitle =
    typeof input.pageTitle === "string" && input.pageTitle.trim().length > 0
      ? input.pageTitle.trim()
      : "Debug Page";

  return {
    async goto(url) {
      currentUrl = url;
      return {
        finalUrl: url,
        url,
      };
    },

    async title() {
      return pageTitle;
    },

    url() {
      return currentUrl;
    },
  };
}

function ensureBootstrapSession(runtimeContext, input = {}) {
  const sessionId =
    typeof input.sessionId === "string" && input.sessionId.trim().length > 0
      ? input.sessionId.trim()
      : "debug-session";

  const target =
    typeof input.target === "string" && input.target.trim().length > 0
      ? input.target.trim()
      : "browser";

  const baseUrl =
    typeof input.baseUrl === "string" && input.baseUrl.trim().length > 0
      ? input.baseUrl.trim()
      : typeof input.url === "string" && input.url.trim().length > 0
        ? input.url.trim()
        : "https://example.com";

  const session = createBrowserSessionState(runtimeContext, {
    sessionId,
    target,
    kind: "debug",
    source: "debug-step",
    baseUrl,
  });

  return { sessionId: session.sessionId, baseUrl };
}

function buildDebugReport(stepType, result, runtimeContext) {
  return {
    ok: true,
    stepType,
    result,
    sessions: runtimeContext?.browser?.sessions || {},
  };
}

async function debugStep(stepType, rawOptions = {}) {
  const input =
    rawOptions && typeof rawOptions.input === "object" && !Array.isArray(rawOptions.input)
      ? rawOptions.input
      : {};

  const runtimeContext = {
    browser: {
      sessions: {},
    },
  };

  if (stepType === "browser.session.start") {
    const target =
      typeof input.target === "string" && input.target.trim().length > 0
        ? input.target.trim()
        : "browser";
    const baseUrl =
      typeof input.baseUrl === "string" && input.baseUrl.trim().length > 0
        ? input.baseUrl.trim()
        : typeof input.url === "string" && input.url.trim().length > 0
          ? input.url.trim()
          : "https://example.com";

    const result = await executeBrowserSessionStartStep({
      runtimeContext,
      sessionId:
        typeof input.sessionId === "string" && input.sessionId.trim().length > 0
          ? input.sessionId.trim()
          : "debug-session",
      input: {
        ...input,
        baseUrl,
      },
      environment: {
        target,
        kind: "debug",
        source: "debug-step",
        baseUrl,
        endpoint: null,
      },
    });

    return buildDebugReport(stepType, result, runtimeContext);
  }

  if (stepType === "browser.page.open") {
    const { sessionId } = ensureBootstrapSession(runtimeContext, input);

    updateBrowserSessionState(runtimeContext, sessionId, {
      runtime: {
        page: createFakePage(input),
      },
    });

    const result = await executeBrowserPageOpenStep({
      runtimeContext,
      sessionId,
      input: {
        url:
          typeof input.url === "string" && input.url.trim().length > 0
            ? input.url.trim()
            : "https://example.com/open",
      },
    });

    return buildDebugReport(stepType, result, runtimeContext);
  }

  if (stepType === "browser.page.wait") {
    const { sessionId } = ensureBootstrapSession(runtimeContext, input);

    updateBrowserSessionState(runtimeContext, sessionId, {
      pageUrl:
        typeof input.pageUrl === "string" && input.pageUrl.trim().length > 0
          ? input.pageUrl.trim()
          : typeof input.url === "string" && input.url.trim().length > 0
            ? input.url.trim()
            : "https://example.com/wait",
      ready: input.ready === undefined ? true : input.ready === true,
      waitStrategy:
        typeof input.waitUntil === "string" && input.waitUntil.trim().length > 0
          ? input.waitUntil.trim()
          : "networkidle",
      waitedMs: Number.isInteger(input.timeoutMs) ? input.timeoutMs : 0,
      runtime: {
        page: createFakePage(input),
      },
    });

    const result = await executeBrowserPageWaitStep({
      runtimeContext,
      sessionId,
      strategy:
        typeof input.waitUntil === "string" && input.waitUntil.trim().length > 0
          ? input.waitUntil.trim()
          : "networkidle",
      waitedMs: Number.isInteger(input.timeoutMs) ? input.timeoutMs : 0,
    });

    return buildDebugReport(stepType, result, runtimeContext);
  }

  if (stepType === "browser.session.stop") {
    const { sessionId } = ensureBootstrapSession(runtimeContext, input);

    updateBrowserSessionState(runtimeContext, sessionId, {
      pageUrl:
        typeof input.pageUrl === "string" && input.pageUrl.trim().length > 0
          ? input.pageUrl.trim()
          : "https://example.com/stop",
      runtime: {
        page: createFakePage(input),
      },
    });

    const result = await executeBrowserSessionStopStep({
      runtimeContext,
      sessionId,
    });

    return buildDebugReport(stepType, result, runtimeContext);
  }

  throw new Error(`Unsupported debug step: ${stepType}`);
}

async function debugStepCommand(...args) {
  const { stepType, input } = parseDebugStepArgs(args);
  const report = await debugStep(stepType, { input });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  return report;
}

module.exports = {
  SUPPORTED_STEPS,
  parseJsonInput,
  parseDebugStepArgs,
  debugStep,
  debugStepCommand,
};
