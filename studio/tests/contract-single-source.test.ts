import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Story 007 D4 (AC4/AC5): the four contract rules - the button host allowlist, the three-button
 * cap, the image-fallback rule and the drop rules - live in `src/launcher-core/` and nowhere else,
 * and the mirror is reached only through `src/contract/launcher-contract.ts`.
 *
 * The scan is on file text, not on behaviour, because what it has to catch is a *copy*: the moment
 * the same rule is written a second time in studio code, the two drift apart on the next re-sync.
 * Calling `buildFeed` and asserting on what it returns is the opposite of that and stays allowed -
 * `expect(slide.template).toBe('text')` observes the rule, it does not restate it.
 *
 * Scoped to `.ts`/`.tsx` under `src/` and `tests/`: `tests/fixtures/news-contract/*.md` is feed
 * *content* (a button url on `github.com`, a `template: cover` line) and never enters the scan.
 */

// `studio/` is one level up from `studio/tests/`.
const studioRoot = fileURLToPath(new URL('..', import.meta.url))

const SCAN_ROOTS = ['src', 'tests']

/** The boundary module: allowed to import the mirror, so it is out of the import check only. */
const BOUNDARY_MODULE = 'src/contract/launcher-contract.ts'

/**
 * Skipped by every check. The mirror is the one legitimate home of all four rules; this file is
 * skipped because it has to spell the rules out to look for them, and a guard that trips over its
 * own needles guards nothing.
 */
const SKIPPED = ['src/launcher-core', 'tests/contract-single-source.test.ts']

function walk(relativeDir: string, found: string[]): void {
  for (const entry of readdirSync(join(studioRoot, relativeDir), { withFileTypes: true })) {
    const relativePath = `${relativeDir}/${entry.name}`
    if (SKIPPED.includes(relativePath)) continue
    if (entry.isDirectory()) {
      walk(relativePath, found)
      continue
    }
    if (relativePath.endsWith('.ts') || relativePath.endsWith('.tsx')) found.push(relativePath)
  }
}

function codeFiles(): string[] {
  const found: string[] = []
  for (const root of SCAN_ROOTS) walk(root, found)
  return found
}

function read(relativePath: string): string {
  return readFileSync(join(studioRoot, relativePath), 'utf8')
}

/** A rule copied into studio code is *declared* there; a re-export (`export { x } from ...`) only
 * names it, which is exactly what the boundary module does and must stay allowed. */
function declarationOf(name: string): RegExp {
  return new RegExp(`\\b(?:function|const|let|var|class)\\s+${name}\\b`)
}

/** Both hosts inside one bracket pair, in either order - a second allowlist. Two `expect(readme)`
 * lines naming the hosts (`tests/boundary.test.ts`) are not a list and stay allowed. */
function hostList(first: string, second: string): RegExp {
  return new RegExp(`\\[[^[\\]]*['"]${first}['"][^[\\]]*['"]${second}['"][^[\\]]*\\]`)
}

/** Exactly the two image-requiring templates as a literal pair - a second `TEMPLATES_REQUIRING_IMAGE`.
 * The full `['split', 'banner', 'text', 'cover']` list is an assertion on delivered templates
 * (`tests/news-contract.test.ts`), not the fallback rule, so the pair must stay adjacent here. */
function templatePair(first: string, second: string): RegExp {
  return new RegExp(`\\[\\s*['"]${first}['"]\\s*,\\s*['"]${second}['"]\\s*,?\\s*\\]`)
}

const GITHUB = 'github\\.com'
const RAW_GITHUB = 'raw\\.githubusercontent\\.com'

const RULE_PATTERNS: { rule: string; pattern: RegExp }[] = [
  // 1. Button host allowlist (`NEWS_BUTTON_HOST_ALLOWLIST`, `isAllowedButtonHost`).
  { rule: 'button host allowlist (literal host list)', pattern: hostList(GITHUB, RAW_GITHUB) },
  { rule: 'button host allowlist (literal host list)', pattern: hostList(RAW_GITHUB, GITHUB) },
  { rule: 'button host allowlist', pattern: declarationOf('NEWS_BUTTON_HOST_ALLOWLIST') },
  { rule: 'button host allowlist', pattern: declarationOf('isAllowedButtonHost') },

  // 2. Three-button cap (`MAX_BUTTONS_PER_SLIDE = 3`). A bare `3` is far too common to forbid
  // (array indices, "four slides", a fixture count), so the `3` only counts in the three shapes
  // that actually cap buttons: a re-declared cap constant, a raw cap slice, a length comparison.
  { rule: 'three-button cap', pattern: /\bMAX_BUTTONS?\w*\s*=\s*3\b/ },
  { rule: 'three-button cap', pattern: /\.slice\(\s*0\s*,\s*3\s*\)/ },
  { rule: 'three-button cap', pattern: /\bbuttons\s*\.\s*length\s*[<>]=?\s*3\b/i },

  // 3. Image-fallback rule (`split`/`cover` without an image fall back to `text`; `banner` does not).
  { rule: 'image-fallback rule', pattern: /\bTEMPLATES_REQUIRING_IMAGE\b/ },
  { rule: 'image-fallback rule', pattern: templatePair('split', 'cover') },
  { rule: 'image-fallback rule', pattern: templatePair('cover', 'split') },
  { rule: 'image-fallback rule', pattern: declarationOf('templateIsSatisfied') },
  // The pipeline's own fallback warning: studio code that produces this sentence has decided the
  // fallback itself. A test that wants to assert the warning matches a short fragment of it
  // instead - `tests/news-contract-fixtures.test.ts` asserts `'text slide'`.
  {
    rule: 'image-fallback rule',
    pattern: /is missing the fields it needs; delivered as a text slide/,
  },

  // 4. Drop rules (no title, unreadable frontmatter, duplicate id, ...): re-implementing one means
  // declaring the pipeline's own deciders a second time instead of reading `buildFeed`'s warnings.
  { rule: 'drop rules', pattern: declarationOf('resolveFeed') },
  { rule: 'drop rules', pattern: declarationOf('buildFeed') },
  { rule: 'drop rules', pattern: declarationOf('filterAndSortSlides') },
  { rule: 'drop rules', pattern: declarationOf('resolveTemplate') },
  { rule: 'drop rules', pattern: declarationOf('sanitizeButtons') },
  { rule: 'drop rules', pattern: declarationOf('parseFrontmatter') },
]

const IMPORT_PATTERNS = [/from\s*['"]([^'"]+)['"]/g, /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g]

function importSpecifiers(text: string): string[] {
  return IMPORT_PATTERNS.flatMap((pattern) => [...text.matchAll(pattern)].map((match) => match[1]))
}

/** The mirror is the `src/launcher-core/` *directory* and the `@shared/*` alias into it. Matched on
 * a whole path segment, so the sync tooling's `scripts/launcher-core-lock` and
 * `scripts/launcher-core.manifest` - different modules that merely start with the same word - are
 * not mistaken for it. */
function reachesMirror(specifier: string): boolean {
  return (
    /(^|\/)launcher-core(\/|$)/.test(specifier) ||
    specifier === '@shared' ||
    specifier.startsWith('@shared/')
  )
}

describe('contract single source', () => {
  it('no contract rule exists outside launcher-core', () => {
    const files = codeFiles()
    // A walk that finds nothing would pass every check below without looking at anything.
    expect(files.length).toBeGreaterThan(0)

    const findings: string[] = []
    for (const file of files) {
      const text = read(file)
      for (const { rule, pattern } of RULE_PATTERNS) {
        if (pattern.test(text)) findings.push(`${file}: ${rule}`)
      }
    }

    expect(findings, 'a contract rule has a second home outside src/launcher-core/').toEqual([])
  })

  it('only the boundary module imports the mirror', () => {
    const findings: string[] = []
    for (const file of codeFiles()) {
      if (file === BOUNDARY_MODULE) continue
      for (const specifier of importSpecifiers(read(file))) {
        if (reachesMirror(specifier)) findings.push(`${file}: ${specifier}`)
      }
    }

    expect(findings, `only ${BOUNDARY_MODULE} may import the mirror`).toEqual([])
  })
})
