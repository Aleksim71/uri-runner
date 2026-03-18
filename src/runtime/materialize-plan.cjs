'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  compileRunbookFile
} = require('./compile-runbook.cjs');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJsonFile(filePath, value) {
  const json = JSON.stringify(value, null, 2) + '\n';
  fs.writeFileSync(filePath, json, 'utf8');
}

function resolveRunbookPath(options = {}) {
  const inboxDir = path.resolve(options.inboxDir || '.');
  const runbookName = options.runbookName || 'RUNBOOK.yaml';
  return path.join(inboxDir, runbookName);
}

function resolvePlanPath(options = {}) {
  if (options.planPath) {
    return path.resolve(options.planPath);
  }

  const artifactsDir = path.resolve(options.artifactsDir || '.');
  return path.join(artifactsDir, 'plan.json');
}

function materializePlanFromRunbook(options = {}) {
  const runbookPath = resolveRunbookPath(options);
  const planPath = resolvePlanPath(options);

  if (!fs.existsSync(runbookPath)) {
    const error = new Error(`materialize-plan: RUNBOOK not found at ${runbookPath}`);
    error.code = 'RUNBOOK_NOT_FOUND';
    error.details = { runbookPath };
    throw error;
  }

  const plan = compileRunbookFile(runbookPath, {
    source: runbookPath
  });

  ensureDir(path.dirname(planPath));
  writeJsonFile(planPath, plan);

  return {
    plan,
    runbookPath,
    planPath
  };
}

module.exports = {
  materializePlanFromRunbook
};
