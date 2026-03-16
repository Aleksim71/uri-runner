'use strict';

const fs = require('fs');
const path = require('path');

/**
 * URI Runner
 * Trace Event Subscriber
 *
 * Writes execution events to append-only JSONL trace log.
 *
 * One event = one line JSON.
 *
 * Example line:
 * {"type":"step_started","timestamp":1710341000,...}
 */

function createTraceEventSubscriber(options) {

  if (!options || typeof options !== 'object') {
    throw new Error('trace-event-subscriber: options required');
  }

  const traceDir = options.traceDir;
  const runId = options.runId;

  if (typeof traceDir !== 'string' || traceDir.trim() === '') {
    throw new Error('trace-event-subscriber: traceDir must be string');
  }

  if (typeof runId !== 'string' || runId.trim() === '') {
    throw new Error('trace-event-subscriber: runId must be string');
  }

  const filePath = path.join(
    traceDir,
    `run-${runId}.events.jsonl`
  );

  ensureDirectory(traceDir);

  const stream = fs.createWriteStream(filePath, {
    flags: 'a'
  });

  function handleEvent(event) {

    const record = {
      timestamp: Date.now(),
      ...event
    };

    const line = JSON.stringify(record);

    stream.write(line + '\n');

  }

  function close() {

    return new Promise((resolve, reject) => {

      stream.end(() => resolve());

      stream.on('error', reject);

    });

  }

  return {
    handleEvent,
    close,
    filePath
  };
}

function ensureDirectory(dir) {

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

}

module.exports = {
  createTraceEventSubscriber
};
