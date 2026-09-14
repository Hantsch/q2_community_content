/**
 * Read-only preflight checks against a `q2-launcher` checkout.
 *
 * Runs in a fixed order and stops at the first failure, so `sync-launcher.ts` (story 005,
 * deliverable D3) can turn a failure into "one sentence naming the path and the problem, exit
 * 1, nothing written" (AC4), and so an uncommitted change to a mirrored file aborts the whole
 * sync before anything is read or written (AC5).
 */
import { execFileSync } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { launcherCoreManifest } from './launcher-core.manifest'

export interface PreflightSuccess {
  readonly ok: true
  readonly commit: string
}

export interface PreflightFailure {
  readonly ok: false
  readonly path: string
  readonly problem: string
}

export type PreflightResult = PreflightSuccess | PreflightFailure

function runGit(args: readonly string[], cwd: string): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' })
}

function fail(path: string, problem: string): PreflightFailure {
  return { ok: false, path, problem }
}

/**
 * The first of the three checkout checks that fails — path missing, not a directory, not a git
 * work tree — or `undefined` when `launcherPath` passes all three.
 *
 * Split out because the drift check (story 006, D2) asserts exactly these three and must not
 * inherit the two below it: it compares a checkout as it stands (uncommitted work included) and
 * turns a missing declared file into a per-file finding rather than a hard stop.
 */
export function launcherCheckoutProblem(launcherPath: string): string | undefined {
  if (!existsSync(launcherPath)) {
    return 'does not exist'
  }

  if (!statSync(launcherPath).isDirectory()) {
    return 'is not a directory'
  }

  try {
    runGit(['rev-parse', '--git-dir'], launcherPath)
  } catch {
    return 'is not a git work tree'
  }

  return undefined
}

/**
 * Runs the read-only preflight checks against `launcherPath`, in the fixed order the story
 * demands: path missing, not a directory, not a git work tree, a declared file missing, a
 * declared file dirty. Returns the launcher's HEAD commit sha on success. Never throws for an
 * expected failure mode, and never writes anything.
 */
export function runPreflight(launcherPath: string): PreflightResult {
  const checkoutProblem = launcherCheckoutProblem(launcherPath)
  if (checkoutProblem !== undefined) {
    return fail(launcherPath, checkoutProblem)
  }

  for (const { source } of launcherCoreManifest) {
    const absoluteSourcePath = join(launcherPath, source)
    if (!existsSync(absoluteSourcePath)) {
      return fail(absoluteSourcePath, 'declared source file is missing')
    }
  }

  const declaredPaths = launcherCoreManifest.map((entry) => entry.source)
  const statusOutput = runGit(['status', '--porcelain', '--', ...declaredPaths], launcherPath)
  if (statusOutput.trim().length > 0) {
    const dirtyRelativePath = statusOutput
      .split('\n')
      .map((line) => line.slice(3).trim())
      .find((line) => line.length > 0)
    const dirtyPath = dirtyRelativePath ? join(launcherPath, dirtyRelativePath) : launcherPath
    return fail(dirtyPath, 'has uncommitted changes')
  }

  const commit = runGit(['rev-parse', 'HEAD'], launcherPath).trim()
  return { ok: true, commit }
}
