'use strict';

const fs = require('node:fs');
const path = require('node:path');

function loadYamlModule() {
  try {
    // External dependency. If the project already uses YAML parsing elsewhere,
    // keep this import aligned with the existing dependency.
    return require('yaml');
  } catch (error) {
    const wrapped = new Error(
      'compile-runbook: missing "yaml" package. Install it or reuse the project YAML parser.'
    );
    wrapped.cause = error;
    throw wrapped;
  }
}

function fail(message, details = {}) {
  const error = new Error(message);
  error.code = 'RUNBOOK_COMPILE_ERROR';
  error.details = details;
  throw error;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeNonEmptyString(value, fieldName) {
  if (typeof value !== 'string') {
    fail(`runbook.${fieldName} must be a string`, { field: fieldName, value });
  }

  const trimmed = value.trim();

  if (!trimmed) {
    fail(`runbook.${fieldName} must not be empty`, { field: fieldName, value });
  }

  return trimmed;
}

function normalizePositiveInteger(value, fieldName, fallback) {
  if (value === undefined || value === null) {
    return fallback;
  }

  if (!Number.isInteger(value) || value <= 0) {
    fail(`runbook.${fieldName} must be a positive integer`, {
      field: fieldName,
      value
    });
  }

  return value;
}

function isWindowsAbsolutePath(input) {
  return /^[a-zA-Z]:[\\/]/.test(input);
}

function normalizeRelativeProjectPath(input, fieldName) {
  const raw = normalizeNonEmptyString(input, fieldName);

  if (raw.includes('\0')) {
    fail(`runbook.${fieldName} must not contain NUL bytes`, {
      field: fieldName,
      value: raw
    });
  }

  if (path.isAbsolute(raw) || isWindowsAbsolutePath(raw)) {
    fail(`runbook.${fieldName} must be a project-relative path`, {
      field: fieldName,
      value: raw
    });
  }

  const normalized = raw.replace(/\\/g, '/');
  const parts = normalized.split('/');

  if (parts.some((part) => part === '..')) {
    fail(`runbook.${fieldName} must not escape project root`, {
      field: fieldName,
      value: raw
    });
  }

  if (parts.some((part) => part.trim() === '')) {
    fail(`runbook.${fieldName} contains an invalid path segment`, {
      field: fieldName,
      value: raw
    });
  }

  return normalized;
}

function ensureArray(value, fieldName) {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    fail(`runbook.${fieldName} must be an array`, { field: fieldName, value });
  }

  return value;
}

function normalizeProvideItem(item, index) {
  const fieldName = `provide[${index}]`;

  if (typeof item === 'string') {
    const filePath = normalizeRelativeProjectPath(item, `${fieldName}.path`);

    return {
      type: 'provide',
      action: 'file.read',
      payload: {
        path: filePath
      }
    };
  }

  if (!isPlainObject(item)) {
    fail(`runbook.${fieldName} must be a string or object`, {
      field: fieldName,
      value: item
    });
  }

  const action = item.action === undefined
    ? 'file.read'
    : normalizeNonEmptyString(item.action, `${fieldName}.action`);

  const filePath = normalizeRelativeProjectPath(item.path, `${fieldName}.path`);

  const step = {
    type: 'provide',
    action,
    payload: {
      path: filePath
    }
  };

  if (item.reason !== undefined) {
    step.payload.reason = normalizeNonEmptyString(item.reason, `${fieldName}.reason`);
  }

  return step;
}

function normalizeModifyItem(item, index) {
  const fieldName = `modify[${index}]`;

  if (typeof item === 'string') {
    const filePath = normalizeRelativeProjectPath(item, `${fieldName}.path`);

    return {
      type: 'modify',
      action: 'file.patch',
      payload: {
        path: filePath
      }
    };
  }

  if (!isPlainObject(item)) {
    fail(`runbook.${fieldName} must be a string or object`, {
      field: fieldName,
      value: item
    });
  }

  const action = item.action === undefined
    ? 'file.patch'
    : normalizeNonEmptyString(item.action, `${fieldName}.action`);

  const filePath = normalizeRelativeProjectPath(item.path, `${fieldName}.path`);

  const step = {
    type: 'modify',
    action,
    payload: {
      path: filePath
    }
  };

  if (item.instructions !== undefined) {
    step.payload.instructions = normalizeNonEmptyString(
      item.instructions,
      `${fieldName}.instructions`
    );
  }

  if (item.reason !== undefined) {
    step.payload.reason = normalizeNonEmptyString(item.reason, `${fieldName}.reason`);
  }

  return step;
}

function normalizeGoalCheckItem(item, index) {
  const fieldName = `goal_checks[${index}]`;

  if (typeof item === 'string') {
    return {
      type: 'check',
      action: 'goal.check',
      payload: {
        text: normalizeNonEmptyString(item, fieldName)
      }
    };
  }

  if (!isPlainObject(item)) {
    fail(`runbook.${fieldName} must be a string or object`, {
      field: fieldName,
      value: item
    });
  }

  const action = item.action === undefined
    ? 'goal.check'
    : normalizeNonEmptyString(item.action, `${fieldName}.action`);

  const text = normalizeNonEmptyString(
    item.text ?? item.check ?? item.assertion,
    `${fieldName}.text`
  );

  return {
    type: 'check',
    action,
    payload: {
      text
    }
  };
}

function compileRunbookObject(runbook, options = {}) {
  const source = options.source || 'RUNBOOK.yaml';

  if (!isPlainObject(runbook)) {
    fail('runbook root must be an object', { source, value: runbook });
  }

  const receiver = normalizeNonEmptyString(runbook.receiver, 'receiver');

  if (receiver !== 'uri') {
    fail('runbook.receiver must be "uri"', { source, receiver });
  }

  const project = normalizeNonEmptyString(runbook.project, 'project');
  const goal = normalizeNonEmptyString(runbook.goal, 'goal');

  const maxAttempts = normalizePositiveInteger(
    runbook.max_attempts,
    'max_attempts',
    1
  );

  const provideItems = ensureArray(runbook.provide, 'provide');
  const modifyItems = ensureArray(runbook.modify, 'modify');
  const goalChecks = ensureArray(runbook.goal_checks, 'goal_checks');

  const provideSteps = provideItems.map(normalizeProvideItem);
  const modifySteps = modifyItems.map(normalizeModifyItem);
  const checkSteps = goalChecks.map(normalizeGoalCheckItem);

  const steps = [
    ...provideSteps,
    ...modifySteps,
    ...checkSteps
  ];

  return {
    version: 1,
    source: {
      type: 'runbook',
      path: source
    },
    receiver: 'uri',
    project,
    goal,
    maxAttempts,
    steps
  };
}

function compileRunbookText(yamlText, options = {}) {
  const source = options.source || 'RUNBOOK.yaml';

  if (typeof yamlText !== 'string') {
    fail('runbook text must be a string', { source, value: yamlText });
  }

  const YAML = loadYamlModule();

  let parsed;
  try {
    parsed = YAML.parse(yamlText);
  } catch (error) {
    const wrapped = new Error(`compile-runbook: invalid YAML in ${source}`);
    wrapped.code = 'RUNBOOK_COMPILE_ERROR';
    wrapped.details = { source };
    wrapped.cause = error;
    throw wrapped;
  }

  return compileRunbookObject(parsed, { source });
}

function compileRunbookFile(filePath, options = {}) {
  const resolvedPath = path.resolve(filePath);
  const yamlText = fs.readFileSync(resolvedPath, 'utf8');

  return compileRunbookText(yamlText, {
    ...options,
    source: options.source || resolvedPath
  });
}

module.exports = {
  compileRunbookObject,
  compileRunbookText,
  compileRunbookFile
};
