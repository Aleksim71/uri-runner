import { describe, it, expect, afterEach } from 'vitest'
import path from 'path'
import {
  createSandbox,
  runNodeScript,
  writeFile,
  listDir,
  exists,
  cleanupSandbox
} from '../helpers/sandbox.cjs'

const sandboxes = []

afterEach(() => {
  while (sandboxes.length > 0) {
    cleanupSandbox(sandboxes.pop())
  }
})

describe('watch-inbox strict intake', () => {
  it('ignores noise files and inbox.zip without META.json', async () => {
    const sb = await createSandbox()
    sandboxes.push(sb)

    writeFile(path.join(sb.downloads, 'note.md'), '# hello\n')
    writeFile(path.join(sb.downloads, 'report.txt'), 'report\n')
    writeFile(path.join(sb.downloads, 'data.json'), '{"ok":true}\n')
    writeFile(path.join(sb.downloads, 'image.png'), 'fake-png\n')
    writeFile(path.join(sb.downloads, 'archive.zip'), 'fake-zip\n')
    writeFile(path.join(sb.downloads, 'inbox.zip'), 'fake-inbox-without-meta\n')

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

    expect(downloadsAfter).toEqual([
      'archive.zip',
      'data.json',
      'image.png',
      'inbox.zip',
      'note.md',
      'report.txt'
    ])

    expect(inboxAfter).toEqual([])

    expect(exists(path.join(sb.downloads, 'inbox.zip'))).toBe(true)
    expect(exists(path.join(sb.inbox, 'inbox.zip'))).toBe(false)

    if (result?.stdout) {
      expect(typeof result.stdout).toBe('string')
    }

    if (result?.stderr) {
      expect(typeof result.stderr).toBe('string')
    }
  })
})
