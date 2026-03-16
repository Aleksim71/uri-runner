'use strict';

const path = require('path');

const {
  pruneHistoryIndex
} = require('../../runtime/history/prune-history-index.cjs');

async function runHistoryPruneCommand(args = []) {
  try {
    const options = parseArgs(args);

    const result = await pruneHistoryIndex({
      projectRoot: options.projectRoot,
      historyIndexPath: path.join(options.projectRoot, 'runtime', 'history', 'index.json'),
      runsDir: path.join(options.projectRoot, 'runtime', 'runs'),
      dryRun: options.dryRun
    });

    console.log('');
    console.log('URI HISTORY PRUNE');
    console.log('────────────────────────');
    console.log(`projectRoot: ${options.projectRoot}`);
    console.log(`indexPath: ${result.indexPath}`);
    console.log(`dryRun: ${String(result.dryRun)}`);
    console.log(`scannedRuns: ${result.scannedRuns}`);
    console.log(`keptRuns: ${result.keptRuns}`);
    console.log(`prunedRuns: ${result.prunedRuns}`);
    console.log(`updated: ${String(result.updated)}`);

    if (result.staleRuns.length > 0) {
      console.log('');
      console.log('STALE RUNS');
      console.log('────────────────────────');

      for (const item of result.staleRuns) {
        console.log(`- ${item.runId || '<missing>'} (${item.reason})`);
      }
    }

    console.log('');

    return {
      status: 'success',
      ...result
    };
  } catch (error) {
    console.error('');
    console.error('URI HISTORY PRUNE ERROR');
    console.error('────────────────────────');
    console.error(error.message);
    console.error('');

    return {
      status: 'error',
      error: error.message
    };
  }
}

function parseArgs(args = []) {
  const input = Array.isArray(args) ? args.slice(0) : [];

  let dryRun = false;
  let projectRoot = null;

  for (let i = 0; i < input.length; i += 1) {
    const value = input[i];

    if (value === '--dry-run') {
      dryRun = true;
      continue;
    }

    if (typeof value === 'string' && value.startsWith('-')) {
      throw new Error(`Unknown option: ${value}`);
    }

    if (projectRoot == null) {
      projectRoot = resolveProjectRoot(value);
      continue;
    }

    throw new Error(`Unexpected argument: ${value}`);
  }

  return {
    dryRun,
    projectRoot: projectRoot || resolveProjectRoot()
  };
}

function resolveProjectRoot(project) {
  if (typeof project === 'string' && project.trim() !== '') {
    return path.resolve(process.cwd(), project);
  }

  return process.cwd();
}

module.exports = {
  runHistoryPruneCommand
};
