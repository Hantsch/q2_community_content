import { describe, expect, it } from 'vitest'

import { resolveRepoRoot } from '../content-repo/paths'
import { readContentRepo } from '../content-repo/read-content-repo'
import { buildRepositoryScanFixture } from '../../tests/fixtures/repository-findings/build-repository-scan-fixture'
import {
  collectRepositoryFindings,
  toRepositoryScan,
  type RepositoryFinding,
} from './repository-findings'

describe('collectRepositoryFindings', () => {
  it("reports no error-severity finding for this repository's real news/ tree", () => {
    const read = readContentRepo({ repoRoot: resolveRepoRoot() })
    const scan = toRepositoryScan(read)

    const findings = collectRepositoryFindings(scan)
    const errors = findings.filter((finding) => finding.severity === 'error')

    expect(errors).toEqual([])
  })

  it('two rows sharing an id name the kept row and the discarded one', () => {
    const read = buildRepositoryScanFixture([
      { id: 'shared', file: 'first.md', title: 'First', body: 'Body one' },
      { id: 'shared', file: 'second.md', title: 'Second', body: 'Body two' },
    ])
    const scan = toRepositoryScan(read)

    const findings = collectRepositoryFindings(scan)
    const duplicates = findings.filter((finding) => finding.kind === 'duplicate-id')

    expect(duplicates).toHaveLength(1)
    expect(duplicates[0]).toMatchObject({
      kind: 'duplicate-id',
      severity: 'error',
      id: 'shared',
      file: 'second.md',
    })
    expect(duplicates[0].message).toContain('first.md')
    expect(duplicates[0].message).toContain('second.md')
  })

  it('two entries sharing an order are reported with the positions they end up in', () => {
    // Same declared `order`, but `beta` is authored before `alpha` in the index - the mirrored
    // `filterAndSortSlides()` stable sort tie-breaks by that index-stable position, so `beta` must
    // be the one delivered first, not `alpha`. Asserting on that (rather than just the shared raw
    // `order` value both entries already declare themselves) is what would catch a regression back
    // to echoing `order` alone with no actual delivered ranking.
    const read = buildRepositoryScanFixture([
      { id: 'beta', title: 'Beta', body: 'Body beta', order: '3' },
      { id: 'alpha', title: 'Alpha', body: 'Body alpha', order: '3' },
    ])
    const scan = toRepositoryScan(read)

    const findings = collectRepositoryFindings(scan)
    const collisions = findings.filter((finding) => finding.kind === 'order-collision')

    expect(collisions).toHaveLength(2)
    const byId: Record<string, RepositoryFinding> = Object.fromEntries(
      collisions.map((finding): [string, RepositoryFinding] => [finding.id ?? '', finding]),
    )

    expect(byId.beta).toMatchObject({
      kind: 'order-collision',
      severity: 'warning',
      file: 'beta.md',
    })
    expect(byId.beta?.message).toContain('order 3')
    expect(byId.beta?.message).toContain('alpha.md')
    // `beta` is delivered first (index-earlier); its own finding must say so, not just echo `order`.
    expect(byId.beta?.message).toContain('first')

    expect(byId.alpha).toMatchObject({
      kind: 'order-collision',
      severity: 'warning',
      file: 'alpha.md',
    })
    expect(byId.alpha?.message).toContain('order 3')
    expect(byId.alpha?.message).toContain('beta.md')
    // `alpha` is delivered after `beta` - the message must name which one it is delivered after.
    expect(byId.alpha?.message).toContain('delivered after')
    expect(byId.alpha?.message).toContain('"beta"')
  })

  it('an unindexed .md is reported as a draft, with info severity and no error', () => {
    const read = buildRepositoryScanFixture([{ id: 'kept', title: 'Kept', body: 'Body' }], {
      drafts: [{ path: 'news/unreleased.md', text: '---\ntitle: Draft\n---\nBody' }],
    })
    const scan = toRepositoryScan(read)

    const findings = collectRepositoryFindings(scan)
    const drafts = findings.filter((finding) => finding.kind === 'draft')

    expect(drafts).toHaveLength(1)
    expect(drafts[0]).toMatchObject({
      kind: 'draft',
      severity: 'info',
      file: 'news/unreleased.md',
    })
    expect(findings.some((finding) => finding.severity === 'error')).toBe(false)
  })

  it('an image no entry references is reported once, noting the launcher never fetches it', () => {
    const read = buildRepositoryScanFixture(
      [{ id: 'entry', title: 'Entry', body: 'Body', image: 'img/used.png' }],
      {
        images: [
          { name: 'used.png', path: 'news/img/used.png', bytes: 10 },
          { name: 'unused.png', path: 'news/img/unused.png', bytes: 10 },
        ],
      },
    )
    const scan = toRepositoryScan(read)

    const findings = collectRepositoryFindings(scan)
    const orphans = findings.filter((finding) => finding.kind === 'orphan-image')

    expect(orphans).toHaveLength(1)
    expect(orphans[0]).toMatchObject({
      kind: 'orphan-image',
      severity: 'info',
      file: 'news/img/unused.png',
    })
    expect(orphans[0].message).toContain('never fetches it')
  })

  it('a row naming a missing document, and a frontmatter order disagreeing with its row, are both reported', () => {
    const missingDocumentReaderFinding = {
      code: 'missing-document',
      severity: 'error' as const,
      message: 'news/gone.md: named by news/index.json but not found on disk',
      path: 'news/gone.md',
    }
    const read = buildRepositoryScanFixture(
      [{ id: 'entry', title: 'Entry', body: 'Body', order: '20', indexOrder: 10 }],
      { findings: [missingDocumentReaderFinding] },
    )
    const scan = toRepositoryScan(read)

    const findings = collectRepositoryFindings(scan)

    const missing = findings.filter((finding) => finding.kind === 'missing-document')
    expect(missing).toHaveLength(1)
    expect(missing[0]).toMatchObject({
      kind: 'missing-document',
      severity: 'error',
      message: missingDocumentReaderFinding.message,
      file: missingDocumentReaderFinding.path,
    })
    // Lifted from story 010's own finding, not independently detected.
    expect(scan.readerFindings).toContainEqual(missingDocumentReaderFinding)

    const mismatches = findings.filter((finding) => finding.kind === 'order-mismatch')
    expect(mismatches).toHaveLength(1)
    expect(mismatches[0]).toMatchObject({
      kind: 'order-mismatch',
      severity: 'warning',
      id: 'entry',
      file: 'entry.md',
    })
    expect(mismatches[0].message).toContain('10')
    expect(mismatches[0].message).toContain('20')
  })

  it('news/_templates files and their example images are neither drafts nor orphans', () => {
    const read = readContentRepo({ repoRoot: resolveRepoRoot() })
    const scan = toRepositoryScan(read)

    const findings = collectRepositoryFindings(scan)
    const templateFindings = findings.filter(
      (finding) =>
        finding.file?.includes('_templates') === true ||
        finding.id?.includes('_templates') === true,
    )

    expect(templateFindings).toEqual([])
  })

  it('an unsafe file name is reported with the rule it breaks, one case per rule', () => {
    const read = buildRepositoryScanFixture(
      [
        { id: 'bad-doc', file: '../secrets.md', title: 'Bad Doc', body: 'Body' },
        { id: 'bad-image', title: 'Bad Image', body: 'Body', image: '../../etc/passwd' },
      ],
      { images: [{ name: 'malware.exe', path: 'news/img/malware.exe', bytes: 10 }] },
    )
    const scan = toRepositoryScan(read)

    const findings = collectRepositoryFindings(scan)
    const unsafe = findings.filter((finding) => finding.kind === 'unsafe-name')
    expect(unsafe).toHaveLength(3)

    const documentRule = unsafe.find((finding) => finding.file === '../secrets.md')
    expect(documentRule).toMatchObject({ kind: 'unsafe-name', severity: 'error' })
    expect(documentRule?.detail).toContain('document rule')
    expect(documentRule?.detail).toContain('../secrets.md')

    const pathSegmentRule = unsafe.find((finding) => finding.file === '../../etc/passwd')
    expect(pathSegmentRule).toMatchObject({ kind: 'unsafe-name', severity: 'error' })
    expect(pathSegmentRule?.detail).toContain('path-segment rule')
    expect(pathSegmentRule?.detail).toContain('../../etc/passwd')

    const extensionRule = unsafe.find((finding) => finding.file === 'news/img/malware.exe')
    expect(extensionRule).toMatchObject({ kind: 'unsafe-name', severity: 'error' })
    expect(extensionRule?.detail).toContain('extension allowlist')
    expect(extensionRule?.detail).toContain('malware.exe')
  })
})
