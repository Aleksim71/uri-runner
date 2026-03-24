'use strict';

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeUrl(value) {
  if (!isNonEmptyString(value)) {
    throw new Error('Browser environment baseUrl must be a non-empty string.');
  }

  let parsed;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`Browser environment baseUrl is invalid: ${value}`);
  }

  if (!parsed.protocol || !parsed.hostname) {
    throw new Error(`Browser environment baseUrl is incomplete: ${value}`);
  }

  const normalized = parsed.toString().replace(/\/$/, '');

  return normalized;
}

function normalizeKind(kind) {
  if (!isNonEmptyString(kind)) {
    throw new Error('Browser environment kind is required.');
  }

  const normalized = kind.trim().toLowerCase();

  if (normalized !== 'web') {
    throw new Error(
      `Unsupported browser environment kind: ${kind}. Expected "web".`
    );
  }

  return normalized;
}

function getEnvironmentMap(input) {
  if (!input || typeof input !== 'object') {
    return {};
  }

  if (input.environment && typeof input.environment === 'object') {
    return input.environment;
  }

  return {};
}

function getBrowserConfig(input) {
  if (!input || typeof input !== 'object') {
    return {};
  }

  if (input.browser && typeof input.browser === 'object') {
    return input.browser;
  }

  return {};
}

function resolveBrowserTarget(browserConfig) {
  const target = browserConfig.target;

  if (!isNonEmptyString(target)) {
    throw new Error('Browser target is required.');
  }

  return target.trim();
}

function resolveBrowserEnvironment(input) {
  const browserConfig = getBrowserConfig(input);
  const environmentMap = getEnvironmentMap(input);
  const target = resolveBrowserTarget(browserConfig);

  const targetEnvironment = environmentMap[target];

  if (!targetEnvironment || typeof targetEnvironment !== 'object') {
    throw new Error(
      `Browser environment target "${target}" is not defined in environment.`
    );
  }

  const kind = normalizeKind(targetEnvironment.kind);
  const baseUrl = normalizeUrl(targetEnvironment.baseUrl);

  const source = isNonEmptyString(targetEnvironment.source)
    ? targetEnvironment.source.trim()
    : 'unknown';

  return {
    target,
    kind,
    baseUrl,
    source
  };
}

module.exports = {
  resolveBrowserEnvironment
};
