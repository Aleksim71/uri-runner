"use strict";

const PLAN_VERSION = 1;
const PLAN_KIND_SCENARIO = "scenario-plan";
const PLAN_KIND_MATERIALIZED = "materialized-plan";

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function createPlanSchemaError(message, details = undefined) {
  const error = new Error(message);
  error.name = "PlanSchemaError";
  error.code = "PLAN_SCHEMA_INVALID";

  if (details && isPlainObject(details)) {
    error.details = details;
  }

  return error;
}

function assertNonEmptyString(value, fieldName, details = undefined) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw createPlanSchemaError(
      `Plan field is invalid: ${fieldName} must be a non-empty string`,
      details || { field: fieldName }
    );
  }

  return value.trim();
}

function assertOptionalPlainObject(value, fieldName, details = undefined) {
  if (value === undefined || value === null) {
    return {};
  }

  if (!isPlainObject(value)) {
    throw createPlanSchemaError(
      `Plan field is invalid: ${fieldName} must be an object`,
      details || { field: fieldName }
    );
  }

  return value;
}

function assertOptionalArray(value, fieldName, details = undefined) {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw createPlanSchemaError(
      `Plan field is invalid: ${fieldName} must be an array`,
      details || { field: fieldName }
    );
  }

  return value;
}

function assertRuntimeShape(runtime) {
  const normalized = assertOptionalPlainObject(runtime, "runtime");

  if (
    normalized.maxSteps !== undefined &&
    normalized.maxSteps !== null &&
    !Number.isFinite(normalized.maxSteps)
  ) {
    throw createPlanSchemaError(
      "Plan runtime is invalid: maxSteps must be a finite number or null",
      { field: "runtime.maxSteps" }
    );
  }

  if (
    normalized.strictCommands !== undefined &&
    typeof normalized.strictCommands !== "boolean"
  ) {
    throw createPlanSchemaError(
      "Plan runtime is invalid: strictCommands must be a boolean",
      { field: "runtime.strictCommands" }
    );
  }

  return {
    maxSteps:
      normalized.maxSteps === undefined ? null : normalized.maxSteps,
    strictCommands:
      normalized.strictCommands === undefined
        ? false
        : normalized.strictCommands,
  };
}

function assertExecutableCtxSnapshot(snapshot) {
  const normalized = assertOptionalPlainObject(
    snapshot,
    "executableCtxSnapshot"
  );

  const engine =
    normalized.engine === undefined || normalized.engine === null
      ? null
      : assertNonEmptyString(normalized.engine, "executableCtxSnapshot.engine");

  const commands = assertOptionalPlainObject(
    normalized.commands,
    "executableCtxSnapshot.commands"
  );

  const runtime = assertOptionalPlainObject(
    normalized.runtime,
    "executableCtxSnapshot.runtime"
  );

  return {
    engine,
    commands,
    runtime,
  };
}

function assertLegacyPlanStep(step, index) {
  if (!isPlainObject(step)) {
    throw createPlanSchemaError(
      "Plan step is invalid: step must be an object",
      { stepIndex: index }
    );
  }

  const kind = assertNonEmptyString(step.kind, "steps[].kind", {
    stepIndex: index,
    field: "kind",
  });

  const stepId = assertNonEmptyString(step.stepId, "steps[].stepId", {
    stepIndex: index,
    field: "stepId",
  });

  if (!Number.isInteger(step.index) || step.index < 0) {
    throw createPlanSchemaError(
      "Plan step is invalid: index must be a non-negative integer",
      {
        stepIndex: index,
        field: "index",
        value: step.index,
      }
    );
  }

  const command = assertNonEmptyString(step.command, "steps[].command", {
    stepIndex: index,
    field: "command",
  });

  const commandRoot = assertNonEmptyString(
    step.commandRoot,
    "steps[].commandRoot",
    {
      stepIndex: index,
      field: "commandRoot",
    }
  );

  const args = assertOptionalPlainObject(step.args, "steps[].args", {
    stepIndex: index,
    field: "args",
  });

  return {
    kind,
    stepId,
    index: step.index,
    command,
    commandRoot,
    args,
  };
}

function assertLegacyPlanSteps(steps) {
  const normalizedSteps = assertOptionalArray(steps, "steps");

  if (normalizedSteps.length === 0) {
    throw createPlanSchemaError(
      "Plan is invalid: steps must be a non-empty array",
      { field: "steps" }
    );
  }

  const seenStepIds = new Set();

  return normalizedSteps.map((step, index) => {
    const normalizedStep = assertLegacyPlanStep(step, index);

    if (normalizedStep.index !== index) {
      throw createPlanSchemaError(
        "Plan step is invalid: index must match array position",
        {
          stepIndex: index,
          expectedIndex: index,
          actualIndex: normalizedStep.index,
        }
      );
    }

    if (seenStepIds.has(normalizedStep.stepId)) {
      throw createPlanSchemaError(
        "Plan step is invalid: duplicate stepId",
        {
          stepIndex: index,
          stepId: normalizedStep.stepId,
        }
      );
    }

    seenStepIds.add(normalizedStep.stepId);

    return normalizedStep;
  });
}

function assertMaterializedPlanStep(step, index) {
  if (!isPlainObject(step)) {
    throw createPlanSchemaError(
      "Materialized plan step is invalid: step must be an object",
      { stepIndex: index }
    );
  }

  const type = assertNonEmptyString(step.type, "steps[].type", {
    stepIndex: index,
    field: "type",
  });

  const action = assertNonEmptyString(step.action, "steps[].action", {
    stepIndex: index,
    field: "action",
  });

  const payload = assertOptionalPlainObject(step.payload, "steps[].payload", {
    stepIndex: index,
    field: "payload",
  });

  if (type === "provide" && action === "file.read") {
    assertNonEmptyString(payload.path, "steps[].payload.path", {
      stepIndex: index,
      field: "payload.path",
    });
  }

  if (type === "check" && action === "goal.check") {
    assertNonEmptyString(payload.text, "steps[].payload.text", {
      stepIndex: index,
      field: "payload.text",
    });
  }

  return {
    type,
    action,
    payload,
    stepId:
      typeof step.stepId === "string" && step.stepId.trim().length > 0
        ? step.stepId.trim()
        : `materialized-step-${index}`,
    index,
  };
}

function assertMaterializedPlanSteps(steps) {
  const normalizedSteps = assertOptionalArray(steps, "steps");

  if (normalizedSteps.length === 0) {
    throw createPlanSchemaError(
      "Plan is invalid: steps must be a non-empty array",
      { field: "steps" }
    );
  }

  return normalizedSteps.map((step, index) =>
    assertMaterializedPlanStep(step, index)
  );
}

function assertLegacyScenarioPlanShape(plan) {
  if (plan.version !== PLAN_VERSION) {
    throw createPlanSchemaError(
      `Plan is invalid: version must be ${PLAN_VERSION}`,
      {
        field: "version",
        expected: PLAN_VERSION,
        actual: plan.version,
      }
    );
  }

  const kind = assertNonEmptyString(plan.kind, "kind");
  if (kind !== PLAN_KIND_SCENARIO) {
    throw createPlanSchemaError(
      `Plan is invalid: unsupported kind ${kind}`,
      {
        field: "kind",
        expected: PLAN_KIND_SCENARIO,
        actual: kind,
      }
    );
  }

  const engine = assertNonEmptyString(plan.engine, "engine");
  const project = assertNonEmptyString(plan.project, "project");
  const runtime = assertRuntimeShape(plan.runtime);
  const executableCtxSnapshot = assertExecutableCtxSnapshot(
    plan.executableCtxSnapshot
  );
  const steps = assertLegacyPlanSteps(plan.steps);

  return {
    version: PLAN_VERSION,
    kind,
    engine,
    project,
    runtime,
    executableCtxSnapshot,
    steps,
  };
}

function assertMaterializedPlanShape(plan) {
  if (plan.version !== PLAN_VERSION) {
    throw createPlanSchemaError(
      `Plan is invalid: version must be ${PLAN_VERSION}`,
      {
        field: "version",
        expected: PLAN_VERSION,
        actual: plan.version,
      }
    );
  }

  const kind = assertNonEmptyString(plan.kind, "kind");
  if (kind !== PLAN_KIND_MATERIALIZED) {
    throw createPlanSchemaError(
      `Plan is invalid: unsupported kind ${kind}`,
      {
        field: "kind",
        expected: PLAN_KIND_MATERIALIZED,
        actual: kind,
      }
    );
  }

  const receiver = assertNonEmptyString(plan.receiver, "receiver");
  if (receiver !== "uri") {
    throw createPlanSchemaError(
      `Plan is invalid: unsupported receiver ${receiver}`,
      {
        field: "receiver",
        expected: "uri",
        actual: receiver,
      }
    );
  }

  const project = assertNonEmptyString(plan.project, "project");
  const goal = assertNonEmptyString(plan.goal, "goal");

  if (
    plan.maxAttempts !== undefined &&
    plan.maxAttempts !== null &&
    (!Number.isInteger(plan.maxAttempts) || plan.maxAttempts <= 0)
  ) {
    throw createPlanSchemaError(
      "Plan is invalid: maxAttempts must be a positive integer",
      {
        field: "maxAttempts",
        actual: plan.maxAttempts,
      }
    );
  }

  const source = assertOptionalPlainObject(plan.source, "source");
  const steps = assertMaterializedPlanSteps(plan.steps);

  return {
    version: PLAN_VERSION,
    kind: PLAN_KIND_MATERIALIZED,
    source,
    receiver,
    project,
    goal,
    maxAttempts:
      plan.maxAttempts === undefined || plan.maxAttempts === null
        ? 1
        : plan.maxAttempts,
    steps,
    runtime: {
      maxSteps: null,
      strictCommands: false,
    },
    executableCtxSnapshot: {
      engine: "materialized",
      commands: {},
      runtime: {},
    },
    engine: "materialized",
  };
}

function assertPlanShape(plan) {
  if (!isPlainObject(plan)) {
    throw createPlanSchemaError("Plan is invalid: object expected");
  }

  if (typeof plan.kind === "string") {
    const kind = plan.kind.trim();

    if (kind === PLAN_KIND_SCENARIO) {
      return assertLegacyScenarioPlanShape(plan);
    }

    if (kind === PLAN_KIND_MATERIALIZED) {
      return assertMaterializedPlanShape(plan);
    }

    throw createPlanSchemaError(
      `Plan is invalid: unsupported kind ${kind}`,
      {
        field: "kind",
        actual: kind,
      }
    );
  }

  return assertMaterializedPlanShape({
    ...plan,
    kind: PLAN_KIND_MATERIALIZED,
  });
}

module.exports = {
  PLAN_VERSION,
  PLAN_KIND_SCENARIO,
  PLAN_KIND_MATERIALIZED,
  isPlainObject,
  createPlanSchemaError,
  assertPlanShape,
};
