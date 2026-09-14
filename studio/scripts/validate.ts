/**
 * `npm run validate [-- --json] [-- --strict]` — headless CLI around story 011's declared-vs-
 * delivered report (story 012, D4). Reads this repository's `news/` tree, builds the report, and
 * prints either a plain-text verdict (default) or a single JSON document (`--json`). Read-only:
 * this command never writes anywhere and never calls `process.exit` — only `process.exitCode`.
 */
import { register } from 'node:module'

import { readMirrorProvenance } from '../src/mirror/read-provenance'
import { readContentRepo } from '../src/content-repo/read-content-repo'
import { exitCodeFor } from '../src/validate/summary'
import { formatValidationText } from '../src/validate/format-text'
import { toValidationPayload } from '../src/validate/format-json'
import { resolveRepoRoot } from './sync-launcher'

// Story 017 D1: `buildValidationSnapshot` reaches story 013's `collectRepositoryFindings()`, and so
// `contract/launcher-safe-names.ts`, whose mirrored module graph contains two imports that only
// resolve through a studio-owned stub. Vite and `tsc` each have their own arm of that boundary;
// plain Node has none, so this CLI installs it itself (see `mirror-boundary-hooks.ts`). The hook
// must be registered *before* the module graph it serves is loaded, which is why this one import is
// dynamic while every other import above stays static - none of those reaches the mirror's
// unresolvable files, so nothing else needs to wait for the hook.
register('./mirror-boundary-hooks.ts', import.meta.url)
const { buildValidationSnapshot } = await import('../src/validate/build-validation-snapshot')

const USAGE = 'usage: npm run validate [-- --json] [-- --strict]'

type Result<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: string }

function ok<T>(value: T): Result<T> {
  return { ok: true, value }
}

function err<T>(error: string): Result<T> {
  return { ok: false, error }
}

interface ParsedArguments {
  readonly json: boolean
  readonly strict: boolean
}

/** Parses `--json` and `--strict`, either/both/neither, in any order. Anything else is a usage
 * error — the story's Decisions (Sprint) rule out a path argument, so there is nothing else to
 * parse. */
export function parseArguments(argv: readonly string[]): Result<ParsedArguments> {
  let json = false
  let strict = false

  for (const argument of argv) {
    if (argument === '--json') {
      json = true
      continue
    }
    if (argument === '--strict') {
      strict = true
      continue
    }
    return err(`unknown argument "${argument}".\n${USAGE}`)
  }

  return ok({ json, strict })
}

function main(): void {
  const parsed = parseArguments(process.argv.slice(2))
  if (!parsed.ok) {
    console.error(parsed.error)
    process.exitCode = 1
    return
  }
  const { json, strict } = parsed.value

  const repoRoot = resolveRepoRoot(process.cwd())
  if (!repoRoot.ok) {
    console.error(repoRoot.error)
    process.exitCode = 1
    return
  }

  const mirror = readMirrorProvenance(repoRoot.value)
  const contentRepo = readContentRepo({ repoRoot: repoRoot.value })

  // One shared composition for every validation surface (story 017, D1) - the CLI derives nothing
  // of its own here, it only prints what the snapshot says.
  const { report, repositoryFindings, summary } = buildValidationSnapshot({
    read: contentRepo,
    mirror,
    now: new Date(),
  })

  if (json) {
    // `toValidationPayload` reads the repository findings off the report object it is handed (the
    // optional field `summarise` already accepts), so they are spread on here rather than passed as
    // a fourth argument - no signature of story 012's changes.
    const payload = toValidationPayload({
      mirror,
      report: { ...report, repositoryFindings },
      summary,
    })
    console.log(JSON.stringify(payload))
  } else {
    for (const line of formatValidationText({ mirror, report, summary })) {
      console.log(line)
    }
  }

  process.exitCode = exitCodeFor(summary, { strict })
}

main()
