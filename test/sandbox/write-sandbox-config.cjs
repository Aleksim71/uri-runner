#!/usr/bin/env node

const { writeSandboxConfig } = require('./create-sandbox-config.cjs')

const sandboxRoot = process.argv[2]

if (!sandboxRoot) {
  console.error('SANDBOX_CONFIG_ERROR: sandbox root required')
  process.exit(1)
}

const configPath = writeSandboxConfig(sandboxRoot)
console.log(configPath)
