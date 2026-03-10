const fs = require('fs')
const path = require('path')
const os = require('os')
const { promisify } = require('util')
const { execFile } = require('child_process')

const execFileAsync = promisify(execFile)

function uniqueSandboxRoot() {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  return path.join(os.tmpdir(), `uri-sandbox-${suffix}`)
}

async function createSandbox(customRoot) {
  const projectRoot = path.resolve(__dirname, '../..')
  const sandboxRoot = customRoot || uniqueSandboxRoot()
  const createScript = path.join(projectRoot, 'test', 'sandbox', 'create-sandbox.sh')

  const { stdout, stderr } = await execFileAsync(createScript, [sandboxRoot], {
    cwd: projectRoot,
    env: process.env
  })

  if (stderr && stderr.trim()) {
    throw new Error(`SANDBOX_CREATE_ERROR: ${stderr.trim()}`)
  }

  const createdRoot = stdout.trim() || sandboxRoot
  const configPath = path.join(createdRoot, 'config.json')

  if (!fs.existsSync(configPath)) {
    throw new Error(`SANDBOX_CONFIG_MISSING: ${configPath}`)
  }

  return {
    projectRoot,
    root: createdRoot,
    configPath,
    downloads: path.join(createdRoot, 'Downloads'),
    inbox: path.join(createdRoot, 'Inbox'),
    processed: path.join(createdRoot, 'processed'),
    watchLog: path.join(createdRoot, 'watch.log'),
    lastRun: path.join(createdRoot, 'last_run.txt')
  }
}

async function runUri(args, sandbox, options = {}) {
  const projectRoot = sandbox.projectRoot || path.resolve(__dirname, '../..')
  const binPath = path.join(projectRoot, 'bin', 'uri.cjs')

  return execFileAsync('node', [binPath, ...args], {
    cwd: projectRoot,
    env: {
      ...process.env,
      URI_CONFIG: sandbox.configPath,
      ...(options.env || {})
    }
  })
}

async function runNodeScript(scriptRelativePath, args, sandbox, options = {}) {
  const projectRoot = sandbox.projectRoot || path.resolve(__dirname, '../..')
  const scriptPath = path.join(projectRoot, scriptRelativePath)

  return execFileAsync('node', [scriptPath, ...args], {
    cwd: projectRoot,
    env: {
      ...process.env,
      URI_CONFIG: sandbox.configPath,
      ...(options.env || {})
    }
  })
}

async function runShellScript(scriptRelativePath, args, sandbox, options = {}) {
  const projectRoot = sandbox.projectRoot || path.resolve(__dirname, '../..')
  const scriptPath = path.join(projectRoot, scriptRelativePath)

  return execFileAsync(scriptPath, args, {
    cwd: projectRoot,
    env: {
      ...process.env,
      URI_CONFIG: sandbox.configPath,
      ...(options.env || {})
    }
  })
}

function writeFile(targetPath, content = '') {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true })
  fs.writeFileSync(targetPath, content, 'utf8')
}

function exists(targetPath) {
  return fs.existsSync(targetPath)
}

function listDir(targetPath) {
  if (!fs.existsSync(targetPath)) return []
  return fs.readdirSync(targetPath).sort()
}

function readText(targetPath) {
  return fs.readFileSync(targetPath, 'utf8')
}

function cleanupSandbox(sandbox) {
  if (!sandbox || !sandbox.root) return
  fs.rmSync(sandbox.root, { recursive: true, force: true })
}

module.exports = {
  createSandbox,
  runUri,
  runNodeScript,
  runShellScript,
  writeFile,
  exists,
  listDir,
  readText,
  cleanupSandbox
}
