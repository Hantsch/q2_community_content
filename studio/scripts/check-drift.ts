/**
 * `npm run check:drift [-- --launcher <path>]` — CLI wrapper around `checkDrift` (story 006, D1 +
 * D2). Prints one line per finding, with a remedy appended for the two kinds that have one
 * (`stale` → re-sync, `locally-edited` → move the change into `q2-launcher` first, per
 * `CLAUDE.md`'s rule that `studio/src/launcher-core/` is mirrored, never hand-edited), then a
 * one-line summary. Read-only: this command never writes anywhere.
 */
import { checkDrift, type DriftFinding } from './drift'
import { resolveRepoRoot } from './sync-launcher'
import { formatProvenance } from '../src/mirror/provenance'
import { readMirrorProvenance } from '../src/mirror/read-provenance'

const USAGE = 'usage: npm run check:drift [-- --launcher <path to a q2-launcher checkout>]'

type Result<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: string }

function ok<T>(value: T): Result<T> {
  return { ok: true, value }
}

function err<T>(error: string): Result<T> {
  return { ok: false, error }
}

/** Parses an optional `--launcher <path>` / `--launcher=<path>`. Anything else is a usage error. */
export function parseArguments(argv: readonly string[]): Result<string | undefined> {
  let launcherPath: string | undefined

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]

    if (argument === '--launcher') {
      const value = argv[index + 1]
      if (value === undefined || value.startsWith('--')) {
        return err(`--launcher needs a path.\n${USAGE}`)
      }
      launcherPath = value
      index += 1
      continue
    }

    if (argument.startsWith('--launcher=')) {
      const value = argument.slice('--launcher='.length)
      if (value.length === 0) return err(`--launcher needs a path.\n${USAGE}`)
      launcherPath = value
      continue
    }

    return err(`unknown argument "${argument}".\n${USAGE}`)
  }

  return ok(launcherPath)
}

/** The remedy sentence appended to a finding's line, when its `kind` has one. */
function remedyFor(finding: DriftFinding, launcherPath: string | undefined): string {
  switch (finding.kind) {
    case 'stale': {
      const path = launcherPath ?? '<path to a q2-launcher checkout>'
      return ` Re-sync the mirror: npm run sync:launcher -- --launcher ${path}`
    }
    case 'locally-edited':
      return ' studio/src/launcher-core/ is mirrored, never hand-edited: move this change into q2-launcher, then re-sync.'
    default:
      return ''
  }
}

function formatFinding(finding: DriftFinding, launcherPath: string | undefined): string {
  const location =
    finding.launcherFile !== undefined
      ? `${finding.file} (launcher: ${finding.launcherFile})`
      : finding.file
  return `[${finding.kind}] ${location}: ${finding.message}${remedyFor(finding, launcherPath)}`
}

function main(): void {
  const parsed = parseArguments(process.argv.slice(2))
  if (!parsed.ok) {
    console.error(parsed.error)
    process.exitCode = 1
    return
  }
  const launcherPath = parsed.value

  const repoRoot = resolveRepoRoot(process.cwd())
  if (!repoRoot.ok) {
    console.error(repoRoot.error)
    process.exitCode = 1
    return
  }

  const provenance = readMirrorProvenance(repoRoot.value)
  for (const line of formatProvenance(provenance)) {
    console.log(line)
  }

  const report = checkDrift({ repoRoot: repoRoot.value, launcherPath })

  if (report.skippedLauncherCompare) {
    console.log(
      'No --launcher given: skipping comparison against the launcher checkout; run with ' +
        '--launcher <path> to also catch a mirror that has fallen behind.',
    )
  }

  for (const finding of report.findings) {
    console.log(formatFinding(finding, launcherPath))
  }

  const fileCount = report.lock?.fileCount ?? 0
  console.log(
    report.ok
      ? `check:drift: ok — ${fileCount} mirrored file(s) checked, no drift found.`
      : `check:drift: FAILED — ${report.findings.length} finding(s) across ${fileCount} mirrored file(s).`,
  )

  process.exitCode = report.ok ? 0 : 1
}

main()
