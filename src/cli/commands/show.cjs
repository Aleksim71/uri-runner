'use strict';

const fs = require('fs');
const path = require('path');

const {
  readHistoryIndex
} = require('../../runtime/history/read-history-index.cjs');

async function runShowCommand(runId, options = {}) {
  try {
    const normalizedRunId = normalizeString(runId);

    if (!normalizedRunId) {
      throw new Error('runId is required');
    }

    const { index } = await readHistoryIndex({
      historyIndexPath: options.historyIndexPath
    });

    const entry = index.runs.find((run) => run.runId === normalizedRunId);

    if (!entry) {
      throw new Error(`run not found: ${normalizedRunId}`);
    }

    if (!entry.traceRelPath) {
      throw new Error(`trace path missing for runId: ${normalizedRunId}`);
    }

    const projectRoot = resolveProjectRoot(options.projectRoot);
    const tracePath = path.resolve(projectRoot, entry.traceRelPath);

    if (!fs.existsSync(tracePath)) {
      throw new Error(`trace file missing for runId: ${normalizedRunId}`);
    }

    const raw = await fs.promises.readFile(tracePath, 'utf8');
    const trace = JSON.parse(raw);

    console.log('');
    console.log('URI SHOW');
    console.log('────────────────────────');
    console.log(`runId: ${trace.runId}`);

    if (trace.createdAt) {
      console.log(`createdAt: ${trace.createdAt}`);
    }

    if (trace.goal) {
      console.log(`goal: ${trace.goal}`);
    }

    console.log(`finalStatus: ${trace.finalStatus}`);
    console.log(`attempts: ${trace.attempts}`);
    console.log(`steps: ${Array.isArray(trace.steps) ? trace.steps.length : 0}`);
    console.log(`trace: ${entry.traceRelPath}`);

    if (entry.outboxRelPath) {
      console.log(`outbox: ${entry.outboxRelPath}`);
    }

    if (entry.planRelPath) {
      console.log(`plan: ${entry.planRelPath}`);
    }

    if (Array.isArray(trace.steps) && trace.steps.length) {
      console.log('');
      console.log('STEP SUMMARY');

      for (const step of trace.steps) {
        console.log(
          `- [${step.phase}] #${step.index} ${step.command} -> ${step.result}`
        );
      }
    }

    console.log('');

    return {
      status: 'success',
      runId: trace.runId
    };
  } catch (error) {
    console.error('');
    console.error('URI SHOW ERROR');
    console.error('────────────────────────');
    console.error(error.message);
    console.error('');

    return {
      status: 'error',
      error: error.message
    };
  }
}

function resolveProjectRoot(projectRoot) {
  if (typeof projectRoot === 'string' && projectRoot.trim() !== '') {
    return path.resolve(projectRoot);
  }

  return path.resolve(__dirname, '../../..');
}

function normalizeString(value) {
  if (value == null) return null;

  const v = String(value).trim();

  return v === '' ? null : v;
}

module.exports = {
  runShowCommand
};
