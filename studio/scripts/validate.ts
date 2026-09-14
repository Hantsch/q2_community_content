/**
 * `npm run validate [-- --json] [-- --strict]` — headless CLI around story 011's declared-vs-
 * delivered report (story 012, D4). Reads this repository's `news/` tree, builds the report, and
 * prints either a plain-text verdict (default) or a single JSON document (`--json`). Read-only:
 * this command never writes anywhere and never calls `process.exit` — only `process.exitCode`.
 */
import { readMirrorProvenance } from '../src/mirror/read-provenance'
import { readContentRepo } from '../src/content-repo/read-content-repo'
import { buildNewsReport } from '../src/report/build-news-report'
import { exitCodeFor, summarise } from '../src/validate/summary'
import { formatValidationText } from '../src/validate/format-text'
import { toValidationPayload } from '../src/validate/format-json'
import { resolveRepoRoot } from './sync-launcher'

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

  const documents = Object.fromEntries(
    Object.entries(contentRepo.documents).map(([file, document]) => [file, document.text]),
  )
  const images = contentRepo.images.map((image) => ({ name: image.name, size: image.bytes }))

  const report = buildNewsReport({
    index: contentRepo.index.value,
    documents,
    now: new Date(),
    images,
  })
  const summary = summarise(report)

  if (json) {
    console.log(JSON.stringify(toValidationPayload({ mirror, report, summary })))
  } else {
    for (const line of formatValidationText({ mirror, report, summary })) {
      console.log(line)
    }
  }

  process.exitCode = exitCodeFor(summary, { strict })
}

main()
