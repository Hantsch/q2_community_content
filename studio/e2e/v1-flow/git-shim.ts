import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export interface GitShim {
  readonly binDir: string
  readonly logPath: string
}

/** A `git` that only logs its argv and fails, so a flow can prove nothing ran git. */
export function installGitShim(): GitShim {
  const binDir = mkdtempSync(join(tmpdir(), 'q2-git-shim-'))
  const logPath = join(binDir, 'git-calls.log')
  const sh = `#!/bin/sh\necho "$*" >> "${logPath.replace(/\\/g, '/')}"\nexit 1\n`
  writeFileSync(join(binDir, 'git'), sh)
  chmodSync(join(binDir, 'git'), 0o755)
  writeFileSync(join(binDir, 'git.cmd'), `@echo off\r\necho %* >> "${logPath}"\r\nexit /b 1\r\n`)
  return { binDir, logPath }
}
