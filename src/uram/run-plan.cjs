// path: src/uram/run-plan.cjs
"use strict";

const fs = require("fs/promises");
const path = require("path");

const { ERROR_CODES } = require("./error-codes.cjs");
const {
  assertPlanShape,
  PLAN_KIND_MATERIALIZED,
} = require("./plan-schema.cjs");
const {
  resetEnvironment,
} = require("../runtime/environment/reset-environment.cjs");
const {
  executeBrowserDiagnosticsStep,
} = require("./execute-browser-diagnostics-step.cjs");
const {
  preflightScenarioPlan,
} = require("../runtime/scenario-command-registry/preflight-scenario-plan.cjs");

class PlanRunError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "PlanRunError";
    this.code = code;

    if (details && typeof details === "object") {
      this.details = details;
    }
  }
}

function createPlanRunError(code, message, details = undefined) {
  return new PlanRunError(code, message, details);
}

function uniquePaths(paths) {
  return [...new Set(paths.filter(Boolean).map((p) => path.resolve(p)))];
}

function normalizeLoadedCommands(commandMap) {
  if (!commandMap || typeof commandMap !== "object") {
    return [];
  }

  return Object.keys(commandMap).sort();
}

function getSystemCommandDirs(projectRoot) {
  return uniquePaths([
    path.join(projectRoot, "contexts", "system", "commands"),
    path.join(projectRoot, "commands", "system"),
    path.join(__dirname, "commands", "system"),
    path.join(__dirname, "..", "commands", "system"),
    path.join(process.cwd(), "src", "uram", "commands", "system"),
    path.join(process.cwd(), "src", "commands", "system"),
  ]);
}

function getProjectCommandDirs(projectRoot) {
  return uniquePaths([
    path.join(projectRoot, "contexts", "project", "commands"),
    path.join(projectRoot, "contexts", "project"),
    path.join(projectRoot, "commands", "project"),
  ]);
}

async function tryLoadCommandDir(dirPath, namespace, target) {
  let entries = [];
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return;
  }

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

    delete require.cache[require.resolve(absolutePath)];
    const mod = require(absolutePath);

    if (typeof mod === "function") {
      target[commandName] = mod;
      continue;
    }

    if (mod && typeof mod.run === "function") {
      target[commandName] = mod.run;
    }
  }
}

async function loadPlanCommands({ projectRoot, executableCtxSnapshot }) {
  const roots =
    executableCtxSnapshot &&
    executableCtxSnapshot.commands &&
    Array.isArray(executableCtxSnapshot.commands.roots)
      ? executableCtxSnapshot.commands.roots
      : [];

  const commands = {};

  for (const root of roots) {
    if (root === "system") {
      for (const dirPath of getSystemCommandDirs(projectRoot)) {
        await tryLoadCommandDir(dirPath, "system", commands);
      }
      continue;
    }

    if (root === "project") {
      for (const dirPath of getProjectCommandDirs(projectRoot)) {
        await tryLoadCommandDir(dirPath, "project", commands);
      }
      continue;
    }

    if (root === "browser") {
      const resolveBrowserSessionId = (context, args = {}) => {
        if (args && typeof args.sessionId === "string" && args.sessionId.trim().length > 0) {
          return args.sessionId.trim();
        }

        const results =
          context && Array.isArray(context.results)
            ? context.results
            : [];

        for (let index = results.length - 1; index >= 0; index -= 1) {
          const item = results[index];
          if (
            item &&
            item.ok === true &&
            item.value &&
            typeof item.value.sessionId === "string" &&
            item.value.sessionId.trim().length > 0
          ) {
            return item.value.sessionId.trim();
          }
        }

        return null;
      };

      commands["browser.session.start"] = async ({ args = {}, context }) => {
        const { executeBrowserSessionStartStep } = require("../runtime/browser/execute-browser-session-start-step.cjs");
        return executeBrowserSessionStartStep({
          runtimeContext: context,
          input: args,
        });
      };

      commands["browser.page.open"] = async ({ args = {}, context }) => {
        const { executeBrowserPageOpenStep } = require("../runtime/browser/execute-browser-page-open-step.cjs");
        return executeBrowserPageOpenStep({
          runtimeContext: context,
          sessionId: resolveBrowserSessionId(context, args),
          path:
            typeof args.path === "string" && args.path.trim().length > 0
              ? args.path.trim()
              : typeof args.url === "string" && args.url.trim().length > 0
                ? args.url.trim()
                : null,
        });
      };

      commands["browser.page.wait"] = async ({ args = {}, context }) => {
        const { executeBrowserPageWaitStep } = require("../runtime/browser/execute-browser-page-wait-step.cjs");
        return executeBrowserPageWaitStep({
          runtimeContext: context,
          sessionId: resolveBrowserSessionId(context, args),
          strategy:
            typeof args.waitUntil === "string" && args.waitUntil.trim().length > 0
              ? args.waitUntil.trim()
              : undefined,
          waitedMs: Number.isInteger(args.timeoutMs) ? args.timeoutMs : undefined,
        });
      };

      commands["browser.diagnostics.collect"] = async ({ args = {}, context }) => {
        const path = require("path");
        const { executeBrowserDiagnosticsCollectStep } = require("../runtime/browser/execute-browser-diagnostics-collect-step.cjs");

        const fallbackBaseDir =
          typeof context?.workspaceDir === "string" && context.workspaceDir.trim().length > 0
            ? path.join(context.workspaceDir, "REPORT", "browser")
            : typeof context?.projectRoot === "string" && context.projectRoot.trim().length > 0
              ? path.join(context.projectRoot, ".tmp-a26", "REPORT", "browser")
              : path.join(process.cwd(), ".tmp-a26", "REPORT", "browser");

        return executeBrowserDiagnosticsCollectStep({
          runtimeContext: context,
          sessionId: resolveBrowserSessionId(context, args),
          baseDir:
            typeof args.baseDir === "string" && args.baseDir.trim().length > 0
              ? args.baseDir.trim()
              : fallbackBaseDir,
          consoleEntries: Array.isArray(args.consoleEntries) ? args.consoleEntries : undefined,
          networkEntries: Array.isArray(args.networkEntries) ? args.networkEntries : undefined,
          pageTitle:
            typeof args.pageTitle === "string" && args.pageTitle.trim().length > 0
              ? args.pageTitle.trim()
              : undefined,
          screenshot: typeof args.screenshot === "boolean" ? args.screenshot : undefined,
        });
      };

      commands["browser.session.stop"] = async ({ args = {}, context }) => {
        const { executeBrowserSessionStopStep } = require("../runtime/browser/execute-browser-session-stop-step.cjs");
        return executeBrowserSessionStopStep({
          runtimeContext: context,
          sessionId: resolveBrowserSessionId(context, args),
        });
      };

      continue;
    }
  }

  return commands;
}

function ensureProjectRoot(projectRoot) {
  if (typeof projectRoot !== "string" || projectRoot.trim().length === 0) {
    throw createPlanRunError(
      ERROR_CODES.PIPELINE_INTERNAL_ERROR,
      "projectRoot is required for plan execution"
    );
  }

  return path.resolve(projectRoot);
}

function assertSafeRelativePath(relPath, fieldName = "path") {
  if (typeof relPath !== "string" || relPath.trim().length === 0) {
    throw createPlanRunError(
      ERROR_CODES.SCENARIO_INVALID,
      `${fieldName} must be a non-empty string`,
      { field: fieldName }
    );
  }

  const normalized = relPath.replace(/\\/g, "/").trim();

  if (normalized.includes("\0")) {
    throw createPlanRunError(
      ERROR_CODES.SCENARIO_INVALID,
      `${fieldName} must not contain NUL bytes`,
      { field: fieldName, value: relPath }
    );
  }

  if (path.isAbsolute(normalized)) {
    throw createPlanRunError(
      ERROR_CODES.SCENARIO_INVALID,
      `${fieldName} must be relative to project root`,
      { field: fieldName, value: relPath }
    );
  }

  const parts = normalized.split("/");

  if (parts.some((part) => part === "..")) {
    throw createPlanRunError(
      ERROR_CODES.SCENARIO_INVALID,
      `${fieldName} must not escape project root`,
      { field: fieldName, value: relPath }
    );
  }

  if (parts.some((part) => part.trim().length === 0)) {
    throw createPlanRunError(
      ERROR_CODES.SCENARIO_INVALID,
      `${fieldName} contains an invalid path segment`,
      { field: fieldName, value: relPath }
    );
  }

  return normalized;
}

function resolveProjectFilePath(projectRoot, relPath) {
  const safeRoot = ensureProjectRoot(projectRoot);
  const safeRelPath = assertSafeRelativePath(relPath, "payload.path");
  const absolutePath = path.resolve(safeRoot, safeRelPath);

  const relativeCheck = path.relative(safeRoot, absolutePath);

  if (
    relativeCheck === ".." ||
    relativeCheck.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativeCheck)
  ) {
    throw createPlanRunError(
      ERROR_CODES.SCENARIO_INVALID,
      "payload.path resolved outside project root",
      {
        field: "payload.path",
        value: relPath,
      }
    );
  }

  return {
    relativePath: safeRelPath,
    absolutePath,
  };
}

async function executeProvideFileReadStep(step, context) {
  const payload =
    step && step.payload && typeof step.payload === "object" ? step.payload : {};

  const { relativePath, absolutePath } = resolveProjectFilePath(
    context.projectRoot,
    payload.path
  );

  let stat;
  try {
    stat = await fs.stat(absolutePath);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      throw createPlanRunError(
        ERROR_CODES.SCENARIO_INVALID,
        `Requested file not found: ${relativePath}`,
        {
          stepId: step.stepId || null,
          type: step.type || "provide",
          action: step.action || "file.read",
          path: relativePath,
        }
      );
    }

    throw createPlanRunError(
      ERROR_CODES.PIPELINE_INTERNAL_ERROR,
      `Failed to stat requested file: ${relativePath}`,
      {
        stepId: step.stepId || null,
        type: step.type || "provide",
        action: step.action || "file.read",
        path: relativePath,
        cause: error && error.message ? error.message : String(error),
      }
    );
  }

  if (!stat.isFile()) {
    throw createPlanRunError(
      ERROR_CODES.SCENARIO_INVALID,
      `Requested path is not a file: ${relativePath}`,
      {
        stepId: step.stepId || null,
        type: step.type || "provide",
        action: step.action || "file.read",
        path: relativePath,
      }
    );
  }

  const content = await fs.readFile(absolutePath, "utf8");

  return {
    kind: "file",
    path: relativePath,
    absolutePath,
    content,
  };
}

async function executeGoalCheckStep(step) {
  const payload =
    step && step.payload && typeof step.payload === "object" ? step.payload : {};

  return {
    acknowledged: true,
    text: typeof payload.text === "string" ? payload.text : "",
  };
}

async function runMaterializedPlan(normalizedPlan, params) {
  const executionContext = {
    runId: params.runId || null,
    workspaceDir: params.workspaceDir || null,
    projectRoot: params.projectRoot,
    results: [],
  };

  let failedStep = null;

  for (const step of normalizedPlan.steps) {
    try {
      let value;

      if (step.type === "provide" && step.action === "file.read") {
        value = await executeProvideFileReadStep(step, executionContext);
      } else if (step.type === "check" && step.action === "goal.check") {
        value = await executeGoalCheckStep(step);
      } else if (step.type === "browser" && step.action === "diagnostics.run") {
        value = await executeBrowserDiagnosticsStep(step, executionContext);
      } else {
        throw createPlanRunError(
          ERROR_CODES.SCENARIO_INVALID,
          `Unsupported materialized step: ${step.type}:${step.action}`,
          {
            stepId: step.stepId || null,
            type: step.type,
            action: step.action,
          }
        );
      }

      executionContext.results.push({
        stepId: step.stepId || null,
        command: null,
        type: step.type || null,
        action: step.action || null,
        ok: true,
        value: value === undefined ? null : value,
      });
    } catch (error) {
      failedStep = step.stepId || null;
      const finishedAt = new Date().toISOString();

      executionContext.results.push({
        stepId: step.stepId || null,
        command: null,
        type: step.type || null,
        action: step.action || null,
        ok: false,
        error: {
          code: error?.code || ERROR_CODES.PIPELINE_INTERNAL_ERROR,
          message: error?.message || "Step execution failed",
          details:
            error && error.details && typeof error.details === "object"
              ? error.details
              : {},
        },
      });

      return {
        exitCode: 1,
        outboxPayload: {
          ok: false,
          engine: normalizedPlan.engine,
          project: normalizedPlan.project,
          loaded_commands: [],
          result: {
            results: executionContext.results,
          },
        },
        meta: {
          loadedCommands: [],
          error: {
            code: error?.code || ERROR_CODES.PIPELINE_INTERNAL_ERROR,
            message: error?.message || "Step execution failed",
            details:
              error && error.details && typeof error.details === "object"
                ? error.details
                : {},
          },
          planRun: {
            startedAt,
            finishedAt,
            executionStatus: "failed",
            stepsTotal: normalizedPlan.steps.length,
            stepsCompleted: executionContext.results.length,
            failedStep,
          },
        },
      };
    }
  }

  const finishedAt = new Date().toISOString();

  return {
    exitCode: 0,
    outboxPayload: {
      ok: true,
      engine: normalizedPlan.engine,
      project: normalizedPlan.project,
      loaded_commands: [],
      result: {
        results: executionContext.results,
      },
    },
    meta: {
      loadedCommands: [],
      planRun: {
        startedAt,
        finishedAt,
        executionStatus: "success",
        stepsTotal: normalizedPlan.steps.length,
        stepsCompleted: executionContext.results.length,
        failedStep: null,
      },
    },
  };
}


function resolveScenarioCommandRegistry(normalizedPlan) {
  const snapshotRuntime =
    normalizedPlan &&
    normalizedPlan.executableCtxSnapshot &&
    normalizedPlan.executableCtxSnapshot.runtime &&
    typeof normalizedPlan.executableCtxSnapshot.runtime === "object"
      ? normalizedPlan.executableCtxSnapshot.runtime
      : {};

  const registry =
    snapshotRuntime.scenario_command_registry &&
    typeof snapshotRuntime.scenario_command_registry === "object"
      ? snapshotRuntime.scenario_command_registry
      : snapshotRuntime.scenarioCommandRegistry &&
        typeof snapshotRuntime.scenarioCommandRegistry === "object"
        ? snapshotRuntime.scenarioCommandRegistry
        : null;

  if (!registry) {
    return {
      enabled: false,
      registryPath: null,
    };
  }

  return {
    enabled: registry.enabled === true,
    registryPath:
      typeof registry.path === "string" && registry.path.trim().length > 0
        ? registry.path.trim()
        : typeof registry.registry_path === "string" &&
          registry.registry_path.trim().length > 0
          ? registry.registry_path.trim()
          : null,
  };
}

function buildScenarioClassificationRequiredResult({
  normalizedPlan,
  executionContext,
  loadedCommands,
  startedAt,
  preflight,
}) {
  const finishedAt = new Date().toISOString();
  const unknownSteps = Array.isArray(preflight?.unknownSteps) ? preflight.unknownSteps : [];
  const classificationRequest =
    preflight && preflight.classificationRequest && typeof preflight.classificationRequest === "object"
      ? preflight.classificationRequest
      : null;
  const firstUnknown = unknownSteps[0] || null;
  const failedStep =
    firstUnknown && typeof firstUnknown.stepId === "string" && firstUnknown.stepId.trim().length > 0
      ? firstUnknown.stepId.trim()
      : null;

  return {
    exitCode: 1,
    outboxPayload: {
      ok: false,
      status: "classification_required",
      engine: normalizedPlan.engine,
      project: normalizedPlan.project,
      loaded_commands: loadedCommands,
      classification_request: classificationRequest,
      result: {
        results: executionContext.results,
      },
    },
    meta: {
      loadedCommands,
      error: {
        code: "CLASSIFICATION_REQUIRED",
        message: `Scenario preflight requires command classification: ${unknownSteps.length} unknown step(s)`,
        details: {
          unknown_steps:
            classificationRequest && Array.isArray(classificationRequest.unknown_steps)
              ? classificationRequest.unknown_steps
              : [],
        },
      },
      planRun: {
        startedAt,
        finishedAt,
        executionStatus: "classification_required",
        stepsTotal: normalizedPlan.steps.length,
        stepsCompleted: executionContext.results.length,
        failedStep,
      },
      preflight: {
        status: preflight?.status || "classification_required",
        registryPath: preflight?.registryPath || null,
        matchedSteps: Array.isArray(preflight?.matchedSteps) ? preflight.matchedSteps.length : 0,
        unknownSteps: unknownSteps.length,
      },
    },
  };
}

function getScenarioRuntime(normalizedPlan) {
  const runtime =
    normalizedPlan &&
    normalizedPlan.runtime &&
    typeof normalizedPlan.runtime === "object"
      ? normalizedPlan.runtime
      : {};

  const snapshotRuntime =
    normalizedPlan &&
    normalizedPlan.executableCtxSnapshot &&
    normalizedPlan.executableCtxSnapshot.runtime &&
    typeof normalizedPlan.executableCtxSnapshot.runtime === "object"
      ? normalizedPlan.executableCtxSnapshot.runtime
      : {};

  const policyMode =
    typeof runtime.policyMode === "string" && runtime.policyMode.trim().length > 0
      ? runtime.policyMode.trim()
      : typeof snapshotRuntime.policy_mode === "string" &&
        snapshotRuntime.policy_mode.trim().length > 0
        ? snapshotRuntime.policy_mode.trim()
        : runtime.strictCommands === true || snapshotRuntime.strict_commands === true
          ? "strict"
          : "safe";

  const strictCommands =
    runtime.strictCommands === true ||
    snapshotRuntime.strict_commands === true ||
    policyMode === "strict";

  const maxSteps = Number.isFinite(runtime.maxSteps)
    ? runtime.maxSteps
    : Number.isFinite(snapshotRuntime.max_steps)
      ? snapshotRuntime.max_steps
      : null;

  const runtimeEnvironment =
    runtime.environment && typeof runtime.environment === "object"
      ? runtime.environment
      : null;

  const snapshotEnvironment =
    snapshotRuntime.environment && typeof snapshotRuntime.environment === "object"
      ? snapshotRuntime.environment
      : null;

  const environment = {
    ...(snapshotEnvironment || {}),
    ...(runtimeEnvironment || {}),
  };

  return {
    strictCommands,
    policyMode,
    maxSteps,
    environment: Object.keys(environment).length > 0 ? environment : null,
  };
}

function buildScenarioFailureResult({
  normalizedPlan,
  executionContext,
  loadedCommands,
  startedAt,
  error,
  failedStep,
}) {
  const finishedAt = new Date().toISOString();

  return {
    exitCode: 1,
    outboxPayload: {
      ok: false,
      engine: normalizedPlan.engine,
      project: normalizedPlan.project,
      loaded_commands: loadedCommands,
      result: {
        results: executionContext.results,
      },
    },
    meta: {
      loadedCommands,
      error: {
        code: error?.code || ERROR_CODES.PIPELINE_INTERNAL_ERROR,
        message: error?.message || "Step execution failed",
        details:
          error && error.details && typeof error.details === "object"
            ? error.details
            : {},
      },
      planRun: {
        startedAt,
        finishedAt,
        executionStatus: "failed",
        stepsTotal: normalizedPlan.steps.length,
        stepsCompleted: executionContext.results.length,
        failedStep,
      },
    },
  };
}

async function runScenarioPlan(normalizedPlan, params) {
  const projectRoot = ensureProjectRoot(params.projectRoot);

  const commands = await loadPlanCommands({
    projectRoot,
    executableCtxSnapshot: normalizedPlan.executableCtxSnapshot,
  });

  const loadedCommands = normalizeLoadedCommands(commands);
  const runtime = getScenarioRuntime(normalizedPlan);
  const strictCommands = runtime.strictCommands === true;
  const maxSteps = runtime.maxSteps;

  if (Number.isFinite(maxSteps) && normalizedPlan.steps.length > maxSteps) {
    throw createPlanRunError(
      ERROR_CODES.MAX_STEPS_EXCEEDED,
      `Plan exceeds runtime.maxSteps: ${normalizedPlan.steps.length} > ${maxSteps}`,
      {
        maxSteps,
        steps: normalizedPlan.steps.length,
      }
    );
  }

  const executionContext = {
    runId: params.runId || null,
    workspaceDir: params.workspaceDir || null,
    projectRoot,
    commands,
    loadedCommands,
    plan: normalizedPlan,
    results: [],
  };

  const scenarioRegistry = resolveScenarioCommandRegistry(normalizedPlan);
  const startedAt = new Date().toISOString();

  if (scenarioRegistry.enabled) {
    const preflight = preflightScenarioPlan({
      plan: normalizedPlan,
      registryPath: scenarioRegistry.registryPath || undefined,
      generatedAt: startedAt,
    });

    if (preflight.status === "classification_required") {
      return buildScenarioClassificationRequiredResult({
        normalizedPlan,
        executionContext,
        loadedCommands,
        startedAt,
        preflight,
      });
    }
  }

  const environmentPolicy = runtime.environment;
  const shouldResetBeforeRun =
    environmentPolicy &&
    (environmentPolicy.reset_before_run === true ||
      environmentPolicy.resetBeforeRun === true);

  if (shouldResetBeforeRun) {
    const environmentReset = await resetEnvironment({
      environment: environmentPolicy,
      cwd: projectRoot,
      workspaceDir: params.workspaceDir || null,
    });

    executionContext.environmentReset = environmentReset;
  }

  let failedStep = null;

  for (const step of normalizedPlan.steps) {
    if (step.kind === "browser") {
      try {
        let value;

        if (step.action === "session.start") {
          const { executeBrowserSessionStartStep } = require("../runtime/browser/execute-browser-session-start-step.cjs");
          value = await executeBrowserSessionStartStep({
            runtimeContext: executionContext,
            input: step.args || {},
            environment: step.environment || null,
            sessionId: step.sessionId || null,
          });
        } else if (step.action === "page.open") {
          const { executeBrowserPageOpenStep } = require("../runtime/browser/execute-browser-page-open-step.cjs");
          value = await executeBrowserPageOpenStep({
            runtimeContext: executionContext,
            input: step.args || {},
            sessionId: step.sessionId || null,
          });
        } else if (step.action === "page.wait") {
          const { executeBrowserPageWaitStep } = require("../runtime/browser/execute-browser-page-wait-step.cjs");
          value = await executeBrowserPageWaitStep({
            runtimeContext: executionContext,
            input: step.args || {},
            sessionId: step.sessionId || null,
          });
        } else if (
          step.action === "diagnostics.collect" ||
          step.action === "diagnostics.run"
        ) {
          const { executeBrowserDiagnosticsCollectStep } = require("../runtime/browser/execute-browser-diagnostics-collect-step.cjs");
          value = await executeBrowserDiagnosticsCollectStep({
            runtimeContext: executionContext,
            input: step.args || {},
            sessionId: step.sessionId || null,
          });
        } else if (step.action === "session.stop") {
          const { executeBrowserSessionStopStep } = require("../runtime/browser/execute-browser-session-stop-step.cjs");
          value = await executeBrowserSessionStopStep({
            runtimeContext: executionContext,
            input: step.args || {},
            sessionId: step.sessionId || null,
          });
        } else {
          throw createPlanRunError(
            ERROR_CODES.SCENARIO_INVALID,
            `Unsupported scenario browser action: ${step.action}`,
            {
              stepId: step.stepId || null,
              kind: step.kind || null,
              action: step.action || null,
            }
          );
        }
        executionContext.results.push({
          stepId: step.stepId || null,
          command: null,
          kind: "browser",
          action: step.action || null,
          ok: true,
          value: value === undefined ? null : value,
        });
      } catch (error) {
        failedStep = step.stepId || null;

        executionContext.results.push({
          stepId: step.stepId || null,
          command: null,
          kind: "browser",
          action: step.action || null,
          ok: false,
          error: {
            code: error?.code || ERROR_CODES.PIPELINE_INTERNAL_ERROR,
            message: error?.message || "Step execution failed",
            details:
              error && error.details && typeof error.details === "object"
                ? error.details
                : {},
          },
        });

        return buildScenarioFailureResult({
          normalizedPlan,
          executionContext,
          loadedCommands,
          startedAt,
          error,
          failedStep,
        });
      }

      continue;
    }

    if (step.kind && step.kind !== "command") {
      const error = createPlanRunError(
        ERROR_CODES.SCENARIO_INVALID,
        `Unsupported scenario step kind: ${step.kind}`,
        {
          stepId: step.stepId || null,
          kind: step.kind || null,
        }
      );

      failedStep = step.stepId || null;
      executionContext.results.push({
        stepId: step.stepId || null,
        command: step.command || null,
        ok: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details || {},
        },
      });

      return buildScenarioFailureResult({
        normalizedPlan,
        executionContext,
        loadedCommands,
        startedAt,
        error,
        failedStep,
      });
    }

    const commandFn = commands[step.command];

    if (typeof commandFn !== "function") {
      const notFoundError = createPlanRunError(
        ERROR_CODES.COMMAND_NOT_FOUND,
        `Command not found: ${step.command}`,
        {
          commandNames: [step.command],
        }
      );

      if (strictCommands) {
        throw notFoundError;
      }

      failedStep = step.stepId || null;
      executionContext.results.push({
        stepId: step.stepId || null,
        command: step.command || null,
        ok: false,
        error: {
          code: notFoundError.code,
          message: notFoundError.message,
          details: notFoundError.details || {},
        },
      });

      return buildScenarioFailureResult({
        normalizedPlan,
        executionContext,
        loadedCommands,
        startedAt,
        error: notFoundError,
        failedStep,
      });
    }

    try {
      const value = await commandFn({
        id: step.stepId,
        command: step.command,
        args: step.args || {},
        context: executionContext,
      });

      executionContext.results.push({
        stepId: step.stepId || null,
        command: step.command || null,
        ok: true,
        value: value === undefined ? null : value,
      });
    } catch (error) {
      failedStep = step.stepId || null;
      executionContext.results.push({
        stepId: step.stepId || null,
        command: step.command || null,
        ok: false,
        error: {
          code: error?.code || ERROR_CODES.PIPELINE_INTERNAL_ERROR,
          message: error?.message || "Step execution failed",
          details:
            error && error.details && typeof error.details === "object"
              ? error.details
              : {},
        },
      });

      return buildScenarioFailureResult({
        normalizedPlan,
        executionContext,
        loadedCommands,
        startedAt,
        error,
        failedStep,
      });
    }
  }

  const finishedAt = new Date().toISOString();

  return {
    exitCode: 0,
    outboxPayload: {
      ok: true,
      engine: normalizedPlan.engine,
      project: normalizedPlan.project,
      loaded_commands: loadedCommands,
      result: {
        results: executionContext.results,
      },
    },
    meta: {
      loadedCommands,
      planRun: {
        startedAt,
        finishedAt,
        executionStatus: "success",
        stepsTotal: normalizedPlan.steps.length,
        stepsCompleted: executionContext.results.length,
        failedStep: null,
      },
    },
  };
}

async function runPlan(params) {
  const { plan } = params || {};
  const normalizedPlan = assertPlanShape(plan);

  if (normalizedPlan.kind === PLAN_KIND_MATERIALIZED) {
    return runMaterializedPlan(normalizedPlan, params || {});
  }

  return runScenarioPlan(normalizedPlan, params || {});
}

module.exports = {
  PlanRunError,
  createPlanRunError,
  runPlan,
};
