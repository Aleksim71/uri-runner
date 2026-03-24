// path: src/runtime/browser/write-browser-report.cjs
'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function writeJson(filePath, data) {
  const content = JSON.stringify(data, null, 2);
  await fs.writeFile(filePath, content, 'utf-8');
}

async function writeBrowserReport(options) {
  if (!options || typeof options !== 'object') {
    throw new Error('writeBrowserReport options must be an object.');
  }

  const baseDir = options.baseDir;
  if (!baseDir || typeof baseDir !== 'string') {
    throw new Error('writeBrowserReport baseDir is required.');
  }

  const reportDir = baseDir;
  await ensureDir(reportDir);

  const artifacts = {};

  if (options.console) {
    const consolePath = path.join(reportDir, 'console.json');
    await writeJson(consolePath, options.console);
    artifacts.console = consolePath;
  }

  if (options.network) {
    const networkPath = path.join(reportDir, 'network.json');
    await writeJson(networkPath, options.network);
    artifacts.network = networkPath;
  }

  if (options.pageMeta) {
    const metaPath = path.join(reportDir, 'page-meta.json');
    await writeJson(metaPath, options.pageMeta);
    artifacts.pageMeta = metaPath;
  }

  if (options.summary) {
    const summaryPath = path.join(reportDir, 'diagnostics-summary.json');
    await writeJson(summaryPath, options.summary);
    artifacts.summary = summaryPath;
  }

  // screenshot пока просто как буфер/строка (A24.2 можно расширить)
  if (options.screenshot) {
    const screenshotPath = path.join(reportDir, 'screenshot.png');
    await fs.writeFile(screenshotPath, options.screenshot);
    artifacts.screenshot = screenshotPath;
  }

  return artifacts;
}

module.exports = {
  writeBrowserReport
};
