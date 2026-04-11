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

    let entry = null;
    let entryHistoryRoot = null;

    const candidateIndexPaths = [];

    if (options.historyIndexPath) {
      candidateIndexPaths.push(path.resolve(options.historyIndexPath));
    } else {
      candidateIndexPaths.push(
        path.resolve(__dirname, '../../../runtime/history/index.json')
      );

      try {
        const projectRoot = resolveProjectRoot(options.projectRoot);

        for (const entry of fs.readdirSync(projectRoot, { withFileTypes: true })) {
          if (!entry.isDirectory()) continue;
          if (!entry.name.endsWith('Box')) continue;

          candidateIndexPaths.push(
            path.resolve(projectRoot, entry.name, 'history', 'index.json')
          );
        }

        const watchBoxesRoot = path.resolve(projectRoot, 'runtime', 'watch');
        if (fs.existsSync(watchBoxesRoot)) {
          for (const entry of fs.readdirSync(watchBoxesRoot, { withFileTypes: true })) {
            if (!entry.isDirectory()) continue;
            if (!entry.name.endsWith('Box')) continue;

            candidateIndexPaths.push(
              path.resolve(watchBoxesRoot, entry.name, 'history', 'index.json')
            );
          }
        }
      } catch (_) {
        // ignore discovery errors
      }
    }

    for (const historyIndexPath of candidateIndexPaths) {
      try {
        const { index } = await readHistoryIndex({ historyIndexPath });
        const found = index.runs.find((run) => run.runId === normalizedRunId);

        if (found) {
          entry = found;
          entryHistoryRoot = path.dirname(historyIndexPath);
          break;
        }
      } catch (_) {
        // ignore missing/unreadable indexes
      }
    }

    if (!entry) {
      throw new Error(`run not found: ${normalizedRunId}`);
    }

    const projectRoot = resolveProjectRoot(options.projectRoot);

    let trace = null;
    let traceLabel = null;

    if (entry.traceRelPath) {
      const tracePath = entryHistoryRoot
        ? path.resolve(entryHistoryRoot, '..', entry.traceRelPath)
        : path.resolve(projectRoot, entry.traceRelPath);

      if (!fs.existsSync(tracePath)) {
        throw new Error(`trace file missing for runId: ${normalizedRunId}`);
      }

      const raw = await fs.promises.readFile(tracePath, 'utf8');
      trace = JSON.parse(raw);
      traceLabel = entry.traceRelPath;
    } else {
      const resultPath = entryHistoryRoot
        ? path.resolve(entryHistoryRoot, 'runs', normalizedRunId, 'RESULT.json')
        : path.resolve(projectRoot, 'runtime', 'history', 'runs', normalizedRunId, 'RESULT.json');

      if (!fs.existsSync(resultPath)) {
        throw new Error(`trace path missing for runId: ${normalizedRunId}`);
      }

      const raw = await fs.promises.readFile(resultPath, 'utf8');
      const result = JSON.parse(raw);

      trace = {
        runId: result.runId || normalizedRunId,
        createdAt: result.startedAt || result.createdAt || null,
        goal: result.goal || null,
        finalStatus: result.executionStatus || result.status || 'unknown',
        attempts: result.attempts || 1,
        steps: Array.isArray(result.steps) ? result.steps : []
      };

      traceLabel = path.relative(projectRoot, resultPath);
    }

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
    console.log(`trace: ${traceLabel}`);

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
