const fs = require('fs')
const path = require('path')
const unzipper = require('unzipper')
const YAML = require('yaml')

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
    lastRun
  }
}

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
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

function findRunbookEntry(directory) {
  return directory.files.find((entry) => {
    const normalized = entry.path.replace(/\\/g, '/')
    const base = normalized.split('/').pop()
    return base === 'RUNBOOK.yaml'
  })
}

async function readRunbookReceiver(zipPath) {
  const directory = await unzipper.Open.file(zipPath)
  const entry = findRunbookEntry(directory)

  if (!entry) {
    return { ok: false, reason: 'missing_runbook' }
  }

  let text
  try {
    const buffer = await entry.buffer()
    text = buffer.toString('utf8')
  } catch {
    return { ok: false, reason: 'unreadable_runbook' }
  }

  let parsed
  try {
    parsed = YAML.parse(text)
  } catch {
    return { ok: false, reason: 'invalid_yaml' }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, reason: 'invalid_runbook_shape' }
  }

  if (typeof parsed.receiver !== 'string' || !parsed.receiver.trim()) {
    return { ok: false, reason: 'missing_receiver' }
  }

  return {
    ok: true,
    receiver: parsed.receiver.trim()
  }
}

async function main() {
  const { config, rootDir } = loadConfig()
  const {
    downloadsDir,
    inboxDir,
    processedDir,
    lastRun
  } = resolvePaths(config, rootDir)

  fs.mkdirSync(downloadsDir, { recursive: true })
  fs.mkdirSync(inboxDir, { recursive: true })
  fs.mkdirSync(processedDir, { recursive: true })

  try {
    const files = fs.readdirSync(downloadsDir).sort()

    for (const name of files) {
      const fullPath = path.join(downloadsDir, name)

      if (!fs.statSync(fullPath).isFile()) {
        continue
      }

      if (!name.endsWith('.zip')) {
        continue
      }

      if (name !== 'inbox.zip') {
        continue
      }

      let inspection
      try {
        inspection = await readRunbookReceiver(fullPath)
      } catch {
        continue
      }

      if (!inspection.ok) {
        continue
      }

      if (inspection.receiver !== 'uri') {
        continue
      }

      const target = path.join(inboxDir, 'inbox.zip')
      fs.copyFileSync(fullPath, target)
      writeProcessedMarker(processedDir)
    }
  } finally {
    safeWriteLastRun(lastRun)
  }
}

main().catch(() => {
  process.exitCode = 1
})
