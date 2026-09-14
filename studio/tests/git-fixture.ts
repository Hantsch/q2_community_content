/**
 * Test helper: a throwaway real git repository in the OS temp dir.
 *
 * Story 005's acceptance tests spawn the real `sync:launcher` CLI against a real launcher
 * checkout, so the fixture has to be an actual `.git` repo — not a mock — and this helper is
 * shared by D1 (this file), D2's preflight tests and D3's CLI integration tests.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

export interface GitFixture {
  /** Absolute path to the fixture's working tree. */
  readonly dir: string
  /** Writes a file (creating parent directories as needed), without committing it. */
  writeFile(relativePath: string, contents: string): void
  /** Stages and commits every change currently in the working tree. */
  commitAll(message?: string): void
  /** Overwrites a file's contents without committing — an uncommitted, "dirty" change. */
  dirtyFile(relativePath: string, contents: string): void
  /** The current HEAD commit sha. */
  headSha(): string
  /** Removes the temp directory. Safe to call more than once. */
  cleanup(): void
}

function runGit(args: readonly string[], cwd: string): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' })
}

/** Creates a fresh, empty git repository in a new temp directory. */
export function createGitFixture(): GitFixture {
  const dir = mkdtempSync(join(tmpdir(), 'q2-launcher-core-fixture-'))

  runGit(['init', '--initial-branch=main'], dir)
  // A local identity keeps this independent of the host's global git config.
  runGit(['config', 'user.email', 'fixture@q2-community-content.test'], dir)
  runGit(['config', 'user.name', 'Launcher Core Fixture'], dir)

  function writeFile(relativePath: string, contents: string): void {
    const fullPath = join(dir, relativePath)
    mkdirSync(dirname(fullPath), { recursive: true })
    writeFileSync(fullPath, contents)
  }

  function commitAll(message = 'fixture commit'): void {
    runGit(['add', '-A'], dir)
    runGit(['commit', '--message', message], dir)
  }

  function dirtyFile(relativePath: string, contents: string): void {
    writeFile(relativePath, contents)
  }

  function headSha(): string {
    return runGit(['rev-parse', 'HEAD'], dir).trim()
  }

  function cleanup(): void {
    rmSync(dir, { recursive: true, force: true })
  }

  return { dir, writeFile, commitAll, dirtyFile, headSha, cleanup }
}
