/**
 * Story 017 D1. These tests never touch the filesystem: the `ContentRepoRead` comes from story
 * 013's in-memory fixture builder, so what is proven here is the composition itself, not a tree on
 * disk.
 *
 * The central assertion (AC7, "structural agreement") is equality against the three functions
 * called directly on the same input — the snapshot must be a composition and nothing more, so no
 * surface built on it can ever show a fact the CLI would not.
 */
import { describe, expect, it } from 'vitest'

import { buildRepositoryScanFixture } from '../../tests/fixtures/repository-findings/build-repository-scan-fixture'
import type { ContentRepoRead } from '../content-repo/read-content-repo'
import type { MirrorProvenance } from '../mirror/provenance'
import { buildNewsReport } from '../report/build-news-report'
import { collectRepositoryFindings, toRepositoryScan } from '../report/repository-findings'
import { buildValidationSnapshot } from './build-validation-snapshot'
import { summarise } from './summary'

const NOW = new Date('2026-03-01T12:00:00.000Z')

function buildMirror(): MirrorProvenance {
  return {
    verdict: 'in-sync',
    launcherCommit: 'a41b3acab4bd3a089f8a04594fff81556fbd6f8a',
    launcherCommitShort: 'a41b3acab4bd',
    syncedAt: '2020-01-01T00:00:00.000Z',
    ageInDays: 42,
    fileCount: 3,
    mismatchedFiles: [],
  }
}

/**
 * One indexed entry (so the report has something to verdict on) plus two repository-level findings
 * that no entry could produce: an unindexed `.md` (draft) and a `news/img/` file no entry declares
 * (orphan image). Both are deliberately clock-independent — no `visibleFrom`/`visibleUntil`, no
 * order collision — so the fixture's findings cannot shift under `toRepositoryScan()`'s own
 * `new Date()`.
 */
function buildRead(): ContentRepoRead {
  return buildRepositoryScanFixture(
    [{ id: 'first', title: 'First', body: 'Body one', order: '1' }],
    {
      drafts: [{ path: 'news/unreleased.md', text: '---\ntitle: Draft\n---\nBody' }],
      images: [{ name: 'orphan.png', path: 'news/img/orphan.png', bytes: 128 }],
    },
  )
}

function toReportInput(read: ContentRepoRead) {
  return {
    index: read.index.value,
    documents: Object.fromEntries(
      Object.entries(read.documents).map(([file, document]) => [file, document.text]),
    ),
    now: NOW,
    images: read.images.map((image) => ({ name: image.name, size: image.bytes })),
  }
}

describe('buildValidationSnapshot', () => {
  it('returns exactly what buildNewsReport, collectRepositoryFindings and summarise return', () => {
    const read = buildRead()

    const snapshot = buildValidationSnapshot({ read, mirror: buildMirror(), now: NOW })

    const report = buildNewsReport(toReportInput(read))
    const repositoryFindings = collectRepositoryFindings(toRepositoryScan(read))

    expect(snapshot.report).toEqual(report)
    expect(snapshot.repositoryFindings).toEqual(repositoryFindings)
    expect(snapshot.summary).toEqual(summarise({ ...report, repositoryFindings }))
  })

  it('reports the repository findings story 013 collects, not an empty list', () => {
    const read = buildRead()

    const snapshot = buildValidationSnapshot({ read, mirror: buildMirror(), now: NOW })

    expect(snapshot.repositoryFindings.length).toBeGreaterThan(0)
    expect(snapshot.repositoryFindings.map((finding) => finding.kind)).toEqual(
      expect.arrayContaining(['draft', 'orphan-image']),
    )
  })

  it('the summary counts the repository findings the snapshot itself carries', () => {
    const read = buildRead()

    const snapshot = buildValidationSnapshot({ read, mirror: buildMirror(), now: NOW })

    expect(snapshot.summary.repositoryFindings).toBe(snapshot.repositoryFindings.length)
    expect(snapshot.summary.total).toBe(snapshot.report.entries.length)
  })

  it('passes the mirror provenance through untouched', () => {
    const mirror = buildMirror()

    const snapshot = buildValidationSnapshot({ read: buildRead(), mirror, now: NOW })

    expect(snapshot.mirror).toBe(mirror)
  })

  it('uses the caller-supplied now rather than the wall clock for the report', () => {
    const read = buildRepositoryScanFixture([
      {
        id: 'scheduled',
        title: 'Scheduled',
        body: 'Body',
        visibleFrom: '2030-01-01T00:00:00.000Z',
      },
    ])

    const before = buildValidationSnapshot({ read, mirror: buildMirror(), now: NOW })
    const after = buildValidationSnapshot({
      read,
      mirror: buildMirror(),
      now: new Date('2031-01-01T00:00:00.000Z'),
    })

    expect(before.report).toEqual(buildNewsReport(toReportInput(read)))
    expect(before.report).not.toEqual(after.report)
  })
})
