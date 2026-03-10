const fs = require('fs')
const path = require('path')

function buildSandboxConfig(sandboxRoot) {
  return {
    version: 1,
    paths: {
      downloads: path.join(sandboxRoot, 'Downloads'),
      uramRoot: sandboxRoot,
      inbox: path.join(sandboxRoot, 'Inbox'),
      processed: path.join(sandboxRoot, 'processed'),
      watchLog: path.join(sandboxRoot, 'watch.log'),
      lastRun: path.join(sandboxRoot, 'last_run.txt')
    },
    watcher: {
      allowedFile: 'inbox.zip',
      metaFile: 'META.json',
      pollInterval: 1000
    }
  }
}

function writeSandboxConfig(sandboxRoot) {
  const config = buildSandboxConfig(sandboxRoot)
  const configPath = path.join(sandboxRoot, 'config.json')

  fs.writeFileSync(
    configPath,
    JSON.stringify(config, null, 2) + '\n',
    'utf8'
  )

  return configPath
}

module.exports = {
  buildSandboxConfig,
  writeSandboxConfig
}
