import { readFileSync, readdirSync } from 'node:fs'
import { join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Story 008 D6 (AC5, AC7): scans every studio-owned stylesheet — everything under `studio/src/`
 * except the mirrored `studio/src/launcher-core/**` — for two things the story's Decisions section
 * forbids the studio from ever doing:
 *
 *   1. a CSS selector naming a mirrored `home-hero-*` class. The studio carries no presentation
 *      for the mirror's markup; `home-hero.css` inside `launcher-core/` is the only place those
 *      classes may be styled.
 *   2. a declaration that redefines one of the mirrored design-token custom properties
 *      (`--color-*`, `--font-display`, `--font-sans`, `--font-mono`, `--radius-*`, `--dur-*`,
 *      `--ease-*`, `--shadow-*`) that the mirrored `index.css`'s `@theme`/`:root` blocks define.
 *
 * Both the file list and the token-name list are read from disk rather than hand-copied, so a
 * stylesheet or a token added later is covered automatically without touching this file.
 *
 * Coverage note: this scans CSS only. Inline `style=`/CSS-in-JS in `.tsx` under `studio/src/**`
 * (excluding `launcher-core/**`, whose files are mirrored, and `mirror-runtime/**` plus
 * `**\/*.test.*`, whose render/mount glue and tests legitimately reference `home-hero-*` class
 * names as string literals when mapping onto or asserting against the mirror's markup — see
 * `mirroredSlides.test.tsx`) was checked by hand and no inline style/CSS-in-JS exists anywhere in
 * this repository today, so a CSS-selector-only scanner is sufficient for now. If inline styling is
 * ever added to the studio's own chrome, this file's coverage should grow to match.
 */

const studioRoot = fileURLToPath(new URL('..', import.meta.url))
const SRC_DIR = join(studioRoot, 'src')
const LAUNCHER_CORE_PREFIX = join('src', 'launcher-core') + sep
const INDEX_CSS = join('src', 'launcher-core', 'src', 'renderer', 'src', 'styles', 'index.css')

const TOKEN_NAME_PATTERN =
  /--(?:color|font-display|font-sans|font-mono|radius|dur|ease|shadow)[\w-]*/g

function listStudioCssFiles(): string[] {
  const entries = readdirSync(SRC_DIR, { recursive: true, encoding: 'utf8' })
  return entries
    .filter((entry) => entry.endsWith('.css'))
    .map((entry) => join('src', entry))
    .filter((relativePath) => !relativePath.startsWith(LAUNCHER_CORE_PREFIX))
}

function read(relativePath: string): string {
  return readFileSync(join(studioRoot, relativePath), 'utf8')
}

/** Strips block comments so a mention inside a comment is never mistaken for a live rule. */
function stripComments(cssText: string): string {
  return cssText.replace(/\/\*[\s\S]*?\*\//g, '')
}

function mirroredTokenNames(): string[] {
  const indexText = stripComments(read(INDEX_CSS))
  const names = new Set<string>()
  for (const match of indexText.matchAll(TOKEN_NAME_PATTERN)) {
    names.add(match[0])
  }
  return [...names]
}

describe('studio stylesheets never style the mirror (story 008 D6, AC5/AC7)', () => {
  const cssFiles = listStudioCssFiles()

  it('found at least the studio chrome stylesheet to scan', () => {
    // Guards against a refactor silently emptying the scan (e.g. a path typo above).
    expect(cssFiles).toContain(join('src', 'styles', 'index.css'))
  })

  it('read at least one mirrored token name off the mirror', () => {
    expect(mirroredTokenNames().length).toBeGreaterThan(0)
  })

  it.each(cssFiles)('%s declares no home-hero-* selector', (relativePath) => {
    const text = stripComments(read(relativePath))
    expect(text).not.toMatch(/home-hero-/)
  })

  it.each(cssFiles)('%s redeclares no mirrored design token', (relativePath) => {
    const text = stripComments(read(relativePath))
    const redeclared = mirroredTokenNames().filter((name) =>
      new RegExp(`(^|[^-\\w])${name}\\s*:`).test(text),
    )
    expect(redeclared).toEqual([])
  })
})
