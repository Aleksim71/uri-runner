import { describe, it, expect, afterEach } from 'vitest'
import path from 'path'
import {
  createSandbox,
  runUri,
  writeFile,
  exists,
  listDir,
  cleanupSandbox
} from '../helpers/sandbox.cjs'

const sandboxes = []

afterEach(() => {
  while (sandboxes.length > 0) {
    const sb = sandboxes.pop()
    cleanupSandbox(sb)
  }
})

describe('sandbox smoke', () => {
  it('creates sandbox with config and isolated directories', async () => {
    const sb = await createSandbox()
    sandboxes.push(sb)

    expect(exists(sb.configPath)).toBe(true)
    expect(exists(sb.downloads)).toBe(true)
    expect(exists(sb.inbox)).toBe(true)
    expect(exists(sb.processed)).toBe(true)

    expect(listDir(sb.downloads)).toEqual([])
    expect(listDir(sb.inbox)).toEqual([])
    expect(listDir(sb.processed)).toEqual([])
  })

  it('runs uri CLI inside sandbox config', async () => {
    const sb = await createSandbox()
    sandboxes.push(sb)

    writeFile(path.join(sb.downloads, 'note.txt'), 'hello sandbox')

    let result
    let error = null

    try {
      result = await runUri(['--help'], sb)
    } catch (err) {
      error = err
    }

    expect(error).toBeNull()

    const stdout = result?.stdout || ''
    const stderr = result?.stderr || ''

    expect(typeof stdout).toBe('string')
    expect(typeof stderr).toBe('string')
    expect(exists(sb.configPath)).toBe(true)
  })
})
