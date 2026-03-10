const fs = require('fs')
const path = require('path')
const unzipper = require('unzipper')

function now() {
  return new Date().toISOString().replace(/\.\d+Z$/, '')
}

function loadConfig() {
  const configPath = process.env.URI_CONFIG
  if (!configPath) {
    throw new Error('URI_CONFIG not set')
  }

  const raw = fs.readFileSync(configPath, 'utf8')
  const config = JSON.parse(raw)

  return {
    config,
    configPath,
    rootDir: path.dirname(configPath)
  }
}

function pickFirst(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value
  }
  return undefined
}

function resolvePaths(config, rootDir) {
  const downloadsDir = pickFirst(
    config.downloads,
    config.downloadsDir,
    config.paths && config.paths.downloads,
    path.join(rootDir, 'Downloads')
  )

  const inboxDir = pickFirst(
    config.inbox,
    config.inboxDir,
    config.paths && config.paths.inbox,
    path.join(rootDir, 'Inbox')
  )

  const processedDir = pickFirst(
    config.processed,
    config.processedDir,
    config.paths && config.paths.processed,
    path.join(rootDir, 'processed')
  )

  const watchLog = pickFirst(
    config.watchLog,
    config.watch_log,
    config.paths && config.paths.watchLog,
    config.paths && config.paths.watch_log,
    path.join(rootDir, 'watch.log')
  )

  const lastRun = pickFirst(
    config.lastRun,
    config.last_run,
    config.paths && config.paths.lastRun,
    config.paths && config.paths.last_run,
    path.join(rootDir, 'last_run.txt')
  )

  return {
    downloadsDir,
    inboxDir,
    processedDir,
    watchLog,
    lastRun
  }
}

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
}

function logLine(logPath, message) {
  ensureParentDir(logPath)
  const line = `[${now()}] ${message}\n`
  fs.appendFileSync(logPath, line, 'utf8')
}

function safeWriteLastRun(filePath) {
  try {
    ensureParentDir(filePath)
    fs.writeFileSync(filePath, `${new Date().toISOString()}\n`, 'utf8')
  } catch {
    // last_run must never break watcher
  }
}

function writeProcessedMarker(processedDir) {
  const markerPath = path.join(processedDir, 'inbox.processed.txt')
  ensureParentDir(markerPath)
  fs.writeFileSync(markerPath, 'accepted inbox.zip\n', 'utf8')
}

async function zipContainsMeta(zipPath) {
  const directory = await unzipper.Open.file(zipPath)
  return directory.files.some((entry) => {
    const normalized = entry.path.replace(/\\/g, '/')
    const base = normalized.split('/').pop()
    return base === 'META.json'
  })
}

async function main() {
  const { config, rootDir } = loadConfig()
  const {
    downloadsDir,
    inboxDir,
    processedDir,
    watchLog,
    lastRun
  } = resolvePaths(config, rootDir)

  fs.mkdirSync(downloadsDir, { recursive: true })
  fs.mkdirSync(inboxDir, { recursive: true })
  fs.mkdirSync(processedDir, { recursive: true })

  try {
    logLine(watchLog, `Scanning: ${downloadsDir}`)

    const files = fs.readdirSync(downloadsDir).sort()

    for (const name of files) {
      const fullPath = path.join(downloadsDir, name)

      if (!fs.statSync(fullPath).isFile()) {
        continue
      }

      if (!name.endsWith('.zip')) {
        logLine(watchLog, `ignore non-zip: ${name}`)
        continue
      }

      if (name !== 'inbox.zip') {
        logLine(watchLog, `ignore zip != inbox.zip: ${name}`)
        continue
      }

      let hasMeta = false
      try {
        hasMeta = await zipContainsMeta(fullPath)
      } catch (err) {
        logLine(watchLog, `ERROR read zip: ${name}: ${err.message}`)
        continue
      }

      if (!hasMeta) {
        logLine(watchLog, 'ignore inbox.zip missing META.json')
        continue
      }

      const target = path.join(inboxDir, 'inbox.zip')

      try {
        fs.copyFileSync(fullPath, target)
        writeProcessedMarker(processedDir)
        logLine(watchLog, 'accepted inbox.zip with META.json')
        logLine(watchLog, `staged inbox.zip -> ${target}`)
      } catch (err) {
        logLine(watchLog, `ERROR staging inbox.zip: ${err.message}`)
      }
    }
  } finally {
    safeWriteLastRun(lastRun)
  }
}

main().catch((err) => {
  try {
    const { config, rootDir } = loadConfig()
    const { watchLog, lastRun } = resolvePaths(config, rootDir)
    logLine(watchLog, `ERROR fatal: ${err.message}`)
    safeWriteLastRun(lastRun)
  } catch {
    // ignore secondary failures
  }

  process.exitCode = 1
})
