'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const {
  buildStableTrace
} = require('./build-stable-trace.cjs');

const {
  applyTraceSchema
} = require('./trace-schema.cjs');

const {
  appendHistoryEntry
} = require('../history/append-history-entry.cjs');

/**
 * URI Runner
 * Trace Finalizer
 *
 * Builds deterministic trace.json from events log
 * and appends compact history entry.
 */

async function finalizeTrace(options) {

  if (!options || typeof options !== 'object') {
    throw new Error('trace-finalizer: options required');
  }

  const traceDir = options.traceDir;
  const runId = options.runId;

  if (typeof traceDir !== 'string' || traceDir.trim() === '') {
    throw new Error('trace-finalizer: traceDir must be string');
  }

  if (typeof runId !== 'string' || runId.trim() === '') {
    throw new Error('trace-finalizer: runId must be string');
  }

  const eventsPath = path.join(
    traceDir,
    `run-${runId}.events.jsonl`
  );

  const tracePath = path.join(
    traceDir,
    `run-${runId}.trace.json`
  );

  const tempPath = tracePath + '.tmp';

  if (!fs.existsSync(eventsPath)) {
    throw new Error(
      `trace-finalizer: events file not found: ${eventsPath}`
    );
  }

  const events = await readEvents(eventsPath);

  const rawTrace = buildStableTrace(events, runId);

  const trace = applyTraceSchema(rawTrace);

  await writeAtomic(tracePath, tempPath, trace);

  const history = await appendHistoryEntry({
    trace,
    tracePath,
    outboxPath: options.outboxPath,
    planPath: options.planPath,
    projectRoot: options.projectRoot,
    historyIndexPath: options.historyIndexPath
  });

  return {
    trace,
    tracePath,
    historyIndexPath: history.historyIndexPath,
    eventCount: events.length
  };
}

async function readEvents(filePath) {

  const events = [];

  const stream = fs.createReadStream(filePath);

  const rl = readline.createInterface({
    input: stream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {

    const trimmed = line.trim();

    if (!trimmed) continue;

    const event = JSON.parse(trimmed);

    events.push(event);

  }

  return events;
}

async function writeAtomic(targetPath, tempPath, data) {

  const json = JSON.stringify(data, null, 2);

  await fs.promises.writeFile(tempPath, json);

  await fs.promises.rename(tempPath, targetPath);

}

module.exports = {
  finalizeTrace
};
