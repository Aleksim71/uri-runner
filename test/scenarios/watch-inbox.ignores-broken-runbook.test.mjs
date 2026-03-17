import { describe, it, expect, afterEach } from 'vitest'
import path from 'path'
import os from 'os'
import fs from 'fs'
import {
  createSandbox,
  runNodeScript,
  writeFile,
  listDir,
  exists,
  cleanupSandbox
} from '../helpers/sandbox.cjs'

import { zipFiles } from '../../src/lib/zip.cjs'

const sandboxes = []

afterEach(() => {
  while (sandboxes.length > 0) {
    cleanupSandbox(sandboxes.pop())
  }
})

describe('watch-inbox ignores broken runbook', () => {
  it('ignores inbox.zip when RUNBOOK.yaml cannot be parsed', async () => {
    const sb = await createSandbox()
    sandboxes.push(sb)

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uri-runbook-broken-'))

    try {
      const runbookPath = path.join(tmpDir, 'RUNBOOK.yaml')
      writeFile(runbookPath, 'receiver: [uri\nversion: 1\n')

      const inboxZipPath = path.join(sb.downloads, 'inbox.zip')

      await zipFiles(inboxZipPath, {
        'RUNBOOK.yaml': runbookPath
      })

      let result
      let error = null

      try {
        result = await runNodeScript(
          'src/uram/watch-inbox-once.cjs',
          [],
          sb
        )
      } catch (err) {
        error = err
      }

      expect(error).toBeNull()

      const downloadsAfter = listDir(sb.downloads)
      const inboxAfter = listDir(sb.inbox)

      expect(downloadsAfter).toEqual(['inbox.zip'])
      expect(inboxAfter).toEqual([])

      expect(exists(path.join(sb.downloads, 'inbox.zip'))).toBe(true)
      expect(exists(path.join(sb.inbox, 'inbox.zip'))).toBe(false)

      if (result?.stdout) {
        expect(typeof result.stdout).toBe('string')
      }

      if (result?.stderr) {
        expect(typeof result.stderr).toBe('string')
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })
})
